/* Dune II DOS comparison regression helper, 2026-11-18, GPL-2.0-or-later.
 * Compiles the production interpreter and observes register writes only. */
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iterator>
#include <utility>
#include <vector>
#include "adl.h"
class CaptureOPL : public Copl {
public:
    std::vector<std::pair<uint8_t,uint8_t>> events;
    void init() override {}
    void write(int reg,int value) override { events.emplace_back(reg,value); }
};
int main(int argc,char **argv) {
    if(argc<5 || (argc-5)%2) return 2;
    std::ifstream file(argv[1],std::ios::binary);
    std::vector<unsigned char> bank((std::istreambuf_iterator<char>(file)),{});
    if(bank.empty()) return 3;
    CaptureOPL opl;
    CadlPlayer player(&opl);
    CFileProvider provider(bank.data(),bank.size());
    if(!player.load("DUNE.ADL",provider)) return 4;
    player.startTrack(std::atoi(argv[2]),255);
    // Ignore construction/reinitialization separately from score behavior.
    opl.events.clear();
    unsigned last=std::atoi(argv[3]);
    for(unsigned tick=1;tick<=last;tick++) {
        for(int i=5;i<argc;i+=2) if((unsigned)std::atoi(argv[i])==tick)
            player.playSoundEffect(std::atoi(argv[i+1]),255);
        player.update();
    }
    FILE *out=std::fopen(argv[4],"wb");
    if(!out) return 5;
    for(auto e:opl.events){std::fputc(e.first,out);std::fputc(e.second,out);}
    std::fclose(out);
    std::printf("%zu\n",opl.events.size());
    return 0;
}
