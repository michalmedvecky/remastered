//@category DOS
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.math.BigInteger;
import ghidra.app.script.GhidraScript;
import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.program.model.address.*;

public class ExportEmc extends GhidraScript {
  Address a(String s) {return currentProgram.getAddressFactory().getAddress(s);}
  @Override public void run() throws Exception {
    Path root=Path.of(getScriptArgs()[0]);Files.createDirectories(root);
    Address start=a("23c4:0558"),end=a("23c4:0b79"),table=a("23c4:0b9e");
    int[] offsets=new int[19];
    for(int i=0;i<19;i++) offsets[i]=Short.toUnsignedInt(currentProgram.getMemory().getShort(table.add(i*2)));
    clearListing(start,end);
    currentProgram.getProgramContext().setValue(currentProgram.getRegister("CS"),start,end,BigInteger.valueOf(0x23c4));
    new DisassembleCommand(start,new AddressSet(start,end),true).applyTo(currentProgram,monitor);
    for(int off:offsets)new DisassembleCommand(a(String.format("23c4:%04x",off)),new AddressSet(start,end),true).applyTo(currentProgram,monitor);
    int[] binary=new int[18];
    for(int i=0;i<18;i++){binary[i]=Short.toUnsignedInt(currentProgram.getMemory().getShort(a("23c4:0b7a").add(i*2)));new DisassembleCommand(a(String.format("23c4:%04x",binary[i])),new AddressSet(start,end),true).applyTo(currentProgram,monitor);}
    try(var out=new PrintWriter(root.resolve("interpreter.asm").toFile(),"UTF-8")) {
      out.println("Opcode table offsets: "+Arrays.toString(offsets));
      out.println("Binary table offsets: "+Arrays.toString(binary));
      for(var ins:currentProgram.getListing().getInstructions(new AddressSet(start,end),true))
        out.printf("0x%x\t%s\t%s\t%s%n",ins.getAddress().getOffset(),ins.getAddress(),HexFormat.of().formatHex(ins.getBytes()),ins);
    }
  }
}
