import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
const workloadTemplate=JSON.parse(readFileSync(new URL('./k3s/workload.template.json',import.meta.url),'utf8'));
const ingressTemplate=JSON.parse(readFileSync(new URL('./k3s/ingress.template.json',import.meta.url),'utf8'));
import {pathToFileURL} from 'node:url';
const dns=/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
function name(value,key){if(typeof value!=='string'||value.length>63||!dns.test(value))throw Error(`${key} must be an explicit DNS label`);return value;}
export function validate(config){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Expected a JSON object');
 const allowed=new Set(['kubeContext','namespace','image','imagePullSecret','expose','host','tlsSecret','ingressClass','ingressController','httpsEntrypoint']);for(const key of Object.keys(config))if(!allowed.has(key))throw Error(`Unknown configuration key: ${key}`);
 if(typeof config.kubeContext!=='string'||!config.kubeContext.trim()||/[\r\n\0]/.test(config.kubeContext))throw Error('kubeContext is required; rendering never selects or contacts it');
 name(config.namespace,'namespace');if(!/^ghcr\.io\/michalmedvecky\/remastered@sha256:[a-f0-9]{64}$/.test(config.image||''))throw Error('image must be ghcr.io/michalmedvecky/remastered@sha256:<64 lowercase hex digits>');
 if(typeof config.expose!=='boolean')throw Error('expose must be boolean');
 for(const key of ['imagePullSecret','tlsSecret','ingressClass']){if(config[key]!==undefined&&typeof config[key]!=='string')throw Error(`${key} must be a string`);if(config[key])name(config[key],key);}
 if(config.expose){if(config.host!=='remastered.500miles.cz')throw Error('host must be remastered.500miles.cz');name(config.tlsSecret,'tlsSecret');name(config.ingressClass,'ingressClass');if(!['traefik','standard'].includes(config.ingressController))throw Error('ingressController must explicitly be traefik or standard');if(config.ingressController==='traefik')name(config.httpsEntrypoint,'httpsEntrypoint');else if(config.httpsEntrypoint)throw Error('httpsEntrypoint applies only to Traefik');}
 return config;
}
export function render(raw){
 const c=validate(raw),values={__NAMESPACE__:c.namespace,__IMAGE__:c.image,__HOST__:c.host,__TLS_SECRET__:c.tlsSecret,__INGRESS_CLASS__:c.ingressClass,__HTTPS_ENTRYPOINT__:c.httpsEntrypoint};
 const replace=v=>typeof v==='string'?(values[v]??v):Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,replace(x)])):v;
 const result=replace(workloadTemplate),pod=result.items.find(x=>x.kind==='Deployment').spec.template.spec;
 if(c.imagePullSecret)pod.imagePullSecrets=[{name:c.imagePullSecret}];
 if(c.expose){const ingress=replace(ingressTemplate);if(c.ingressController!=='traefik')delete ingress.metadata.annotations;result.items.push(ingress);}
 if(/__[A-Z_]+__/.test(JSON.stringify(result)))throw Error('Unresolved manifest template value');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error('Usage: node deploy/render.mjs deploy/config.local.json > /tmp/remastered.json');console.log(JSON.stringify(render(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
