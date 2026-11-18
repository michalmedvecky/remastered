/* Dune II browser port modifications: 2026-11-18.
 * Changed for browser integration and/or V1.07 compatibility;
 * original copyright and license notices are retained below.
 */
/** @file src/table/sound.c Sound file tables. */

#include <stdio.h>
#include "types.h"

#include "../audio/sound.h"

/** Available voices.
 * Prefix :
 *  '+' : Don't include in voiceSet 0xFFFF
 *  '?' : don't preload voice in RAM
 *  '/' : Only include in voiceSet 0xFFFE
 *  '-' : Only include in voiceSet 0xFFFF
 *  '%' : Don't include in voiceSet 0xFFFF and 0xFFFE
 * %c => replaced by language 'F'(french) 'G'(german) 'Z'
 *       or house prefix char ('A'treides, 'O'rdos or Fremen,
 *           'H'arkonnen or Sardokar, 'M'ercenary)
 */
const VoiceData g_table_voices[NUM_VOICES] = {
	{"+VSCREAM1.VOC", 11},
	{"+EXSAND.VOC", 10},
	{"+ROCKET.VOC", 11},
	{"+BUTTON.VOC", 10},
	{"+VSCREAM5.VOC", 11},
	{"+CRUMBLE.VOC", 15},
	{"+EXSMALL.VOC", 9},
	{"+EXMED.VOC", 10},
	{"+EXLARGE.VOC", 14},
	{"+EXCANNON.VOC", 11},
	{"+GUNMULTI.VOC", 9},
	{"+GUN.VOC", 10},
	{"+EXGAS.VOC", 10},
	{"+EXDUD.VOC", 10},
	{"+VSCREAM2.VOC", 11},
	{"+VSCREAM3.VOC", 11},
	{"+VSCREAM4.VOC", 11},
	{"+AFFIRM.VOC", 15},
	{"+REPORT1.VOC", 15},
	{"+REPORT2.VOC", 15},
	{"+REPORT3.VOC", 15},
	{"+OVEROUT.VOC", 15},
	{"+MOVEOUT.VOC", 15},
	{"?POPPA.VOC", 15},
	{"?SANDBUG.VOC", 15},
	{"+STATICP.VOC", 10},
	{"+WORMET3P.VOC", 16},
	{"+MISLTINP.VOC", 10},
	{"+SQUISH2.VOC", 12},
	{"%cENEMY.VOC", 20},
	{"%cHARK.VOC", 20},
	{"%cATRE.VOC", 20},
	{"%cORDOS.VOC", 20},
	{"%cFREMEN.VOC", 20},
	{"%cSARD.VOC", 20},
	{"FILLER.VOC", 20},
	{"%cUNIT.VOC", 20},
	{"%cSTRUCT.VOC", 20},
	{"%cONE.VOC", 19},
	{"%cTWO.VOC", 19},
	{"%cTHREE.VOC", 19},
	{"%cFOUR.VOC", 19},
	{"%cFIVE.VOC", 19},
	{"%cCONST.VOC", 20},
	{"%cRADAR.VOC", 20},
	{"%cOFF.VOC", 20},
	{"%cON.VOC", 20},
	{"%cFRIGATE.VOC", 20},
	{"?%cARRIVE.VOC", 20},
	{"%cWARNING.VOC", 20},
	{"%cSABOT.VOC", 20},
	{"%cMISSILE.VOC", 20},
	{"%cBLOOM.VOC", 20},
	{"%cDESTROY.VOC", 20},
	{"%cDEPLOY.VOC", 20},
	{"%cAPPRCH.VOC", 20},
	{"%cLOCATED.VOC", 20},
	{"%cNORTH.VOC", 20},
	{"%cEAST.VOC", 20},
	{"%cSOUTH.VOC", 20},
	{"%cWEST.VOC", 20},
	{"?%cWIN.VOC", 20},
	{"?%cLOSE.VOC", 20},
	{"%cLAUNCH.VOC", 20},
	{"%cATTACK.VOC", 20},
	{"%cVEHICLE.VOC", 20},
	{"%cREPAIR.VOC", 20},
	{"%cHARVEST.VOC", 20},
	{"%cWORMY.VOC", 20},
	{"%cCAPTURE.VOC", 20},
	{"%cNEXT.VOC", 20},
	{"%cNEXT2.VOC", 20},
	{"/BLASTER.VOC", 10},
	{"/GLASS6.VOC", 10},
	{"/LIZARD1.VOC", 10},
	{"/FLESH.VOC", 10},
	{"/CLICK.VOC", 10},
	{"-3HOUSES.VOC", 12},
	{"-ANDNOW.VOC", 12},
	{"-ARRIVED.VOC", 12},
	{"-BATTLE.VOC", 12},
	{"-BEGINS.VOC", 12},
	{"-BLDING.VOC", 12},
	{"-CONTROL2.VOC", 12},
	{"-CONTROL3.VOC", 12},
	{"-CONTROL4.VOC", 12},
	{"-CONTROLS.VOC", 12},
	{"-DUNE.VOC", 12},
	{"-DYNASTY.VOC", 12},
	{"-EACHHOME.VOC", 12},
	{"-EANDNO.VOC", 12},
	{"-ECONTROL.VOC", 12},
	{"-EHOUSE.VOC", 12},
	{"-EMPIRE.VOC", 12},
	{"-EPRODUCE.VOC", 12},
	{"-ERULES.VOC", 12},
	{"-ETERRIT.VOC", 12},
	{"-EMOST.VOC", 12},
	{"-ENOSET.VOC", 12},
	{"-EVIL.VOC", 12},
	{"-HARK.VOC", 12},
	{"-HOME.VOC", 12},
	{"-HOUSE2.VOC", 12},
	{"-INSID.VOC", 12},
	{"-KING.VOC", 12},
	{"-KNOWN.VOC", 12},
	{"-MELANGE.VOC", 12},
	{"-NOBLE.VOC", 12},
	{"?NOW.VOC", 12},
	{"-OFDUNE.VOC", 12},
	{"-ORD.VOC", 12},
	{"-PLANET.VOC", 12},
	{"-PREVAIL.VOC", 12},
	{"-PROPOSED.VOC", 12},
	{"-SANDLAND.VOC", 12},
	{"-SPICE.VOC", 12},
	{"-SPICE2.VOC", 12},
	{"-VAST.VOC", 12},
	{"-WHOEVER.VOC", 12},
	{"?YOUR.VOC", 12},
	{"?FILLER.VOC", 12},
	{"-DROPEQ2P.VOC", 10},
	{"/EXTINY.VOC", 10},
	{"-WIND2BP.VOC", 10},
	{"-BRAKES2P.VOC", 11},
	{"-GUNSHOT.VOC", 10},
	{"-GLASS.VOC", 11},
	{"-MISSLE8.VOC", 10},
	{"-CLANK.VOC", 10},
	{"-BLOWUP1.VOC", 10},
	{"-BLOWUP2.VOC", 11},
	{"+OK.VOC", 15},
};

static const char _music_dune00[] = "dune0";
static const char _music_dune01[] = "dune1";
static const char _music_dune02[] = "dune2";
static const char _music_dune03[] = "dune3";
static const char _music_dune04[] = "dune4";
static const char _music_dune05[] = "dune5";
static const char _music_dune06[] = "dune6";
static const char _music_dune07[] = "dune7";
static const char _music_dune08[] = "dune8";
static const char _music_dune09[] = "dune9";
static const char _music_dune10[] = "dune10";
static const char _music_dune11[] = "dune11";
static const char _music_dune12[] = "dune12";
static const char _music_dune13[] = "dune13";
static const char _music_dune14[] = "dune14";
static const char _music_dune15[] = "dune15";
static const char _music_dune16[] = "dune16";
static const char _music_dune17[] = "dune17";
static const char _music_dune18[] = "dune18";
static const char _music_dune19[] = "dune19";
static const char _music_dune20[] = "dune20";

/**
 * Available music.
 * @note The code compares pointers rather than the text itself, thus strings must be unique.
 */
const MusicData g_table_musics[] = {
	{NULL,          0}, /*  0 */
	{_music_dune01, 2}, /*  1 */
	{_music_dune01, 3}, /*  2 */
	{_music_dune01, 4}, /*  3 */
	{_music_dune01, 5}, /*  4 */
	{_music_dune17, 4}, /*  5 */
	{_music_dune08, 3}, /*  6 */
	{_music_dune08, 2}, /*  7 */
	{_music_dune01, 6}, /*  8 */
	{_music_dune02, 6}, /*  9 */
	{_music_dune03, 6}, /* 10 */
	{_music_dune04, 6}, /* 11 */
	{_music_dune05, 6}, /* 12 */
	{_music_dune06, 6}, /* 13 */
	{_music_dune09, 4}, /* 14 */
	{_music_dune09, 5}, /* 15 */
	{_music_dune18, 6}, /* 16 */
	{_music_dune10, 7}, /* 17 */
	{_music_dune11, 7}, /* 18 */
	{_music_dune12, 7}, /* 19 */
	{_music_dune13, 7}, /* 20 */
	{_music_dune14, 7}, /* 21 */
	{_music_dune15, 7}, /* 22 */
	{_music_dune01, 8}, /* 23 */
	{_music_dune07, 2}, /* 24 */
	{_music_dune07, 3}, /* 25 */
	{_music_dune07, 4}, /* 26 */
	{_music_dune00, 2}, /* 27 */
	{_music_dune07, 6}, /* 28 */
	{_music_dune16, 7}, /* 29 */
	{_music_dune19, 4}, /* 30 */
	{_music_dune19, 2}, /* 31 */
	{_music_dune19, 3}, /* 32 */
	{_music_dune20, 2}, /* 33 */
	{_music_dune16, 8}, /* 34 */
	{_music_dune00, 3}, /* 35 */
	{_music_dune00, 4}, /* 36 */
	{_music_dune00, 5}, /* 37 */
};

/**
 * Mapping soundID -> voice.
 */
const uint16 g_table_voiceMapping[] = {
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	13,
	65535,
	65535,
	65535,
	121,
	65535,
	65535,
	65535,
	65535,
	65535,
	0,
	4,
	14,
	15,
	16,
	28,
	65535,
	65535,
	3,
	12,
	1,
	7,
	2,
	65535,
	5,
	65535,
	65535,
	65535,
	65535,
	7,
	6,
	8,
	65535,
	65535,
	122,
	65535,
	9,
	9,
	11,
	10,
	43,
	65535,
	25,
	26,
	27,
	72,
	73,
	74,
	75,
	76,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	65535,
	123,
	65535,
	124,
	65535,
	125,
	126,
	127,
	65535,
	65535,
	128,
	129,
	130,
};

/**
 * Feedback on events and user commands (English audio, viewport message, and sound).
 * @see g_translatedVoice
 */
const Feedback g_feedback[] = {
	{{43, 65535, 65535, 65535, 65535}, 51, 60},
	{{49, 29, 36, 55, 65535}, 52, 65535},
	{{49, 29, 36, 55, 57}, 52, 65535},
	{{49, 29, 36, 55, 58}, 52, 65535},
	{{49, 29, 36, 55, 59}, 52, 65535},
	{{49, 29, 36, 55, 60}, 52, 65535},
	{{49, 30, 36, 55, 65535}, 53, 65535},
	{{49, 31, 36, 55, 65535}, 54, 65535},
	{{49, 32, 36, 55, 65535}, 55, 65535},
	{{49, 33, 36, 55, 65535}, 56, 65535},
	{{49, 34, 55, 65535, 65535}, 57, 65535},
	{{49, 35, 36, 55, 65535}, 58, 65535},
	{{49, 50, 55, 65535, 65535}, 59, 65535},
	{{29, 36, 53, 65535, 65535}, 0, 65535},
	{{30, 36, 53, 65535, 65535}, 60, 65535},
	{{31, 36, 53, 65535, 65535}, 61, 65535},
	{{32, 36, 53, 65535, 65535}, 62, 65535},
	{{33, 36, 53, 65535, 65535}, 63, 65535},
	{{34, 53, 65535, 65535, 65535}, 64, 65535},
	{{35, 36, 53, 65535, 65535}, 65, 65535},
	{{50, 53, 65535, 65535, 65535}, 0, 65535},
	{{29, 37, 53, 65535, 65535}, 0, 65535},
	{{30, 37, 53, 65535, 65535}, 66, 65535},
	{{31, 37, 53, 65535, 65535}, 67, 65535},
	{{32, 37, 53, 65535, 65535}, 68, 65535},
	{{33, 37, 53, 65535, 65535}, 69, 65535},
	{{34, 53, 65535, 65535, 65535}, 70, 65535},
	{{35, 37, 53, 65535, 65535}, 71, 65535},
	{{44, 46, 65535, 65535, 65535}, 0, 65535},
	{{44, 45, 65535, 65535, 65535}, 0, 65535},
	{{30, 36, 54, 65535, 65535}, 72, 65535},
	{{31, 36, 54, 65535, 65535}, 73, 65535},
	{{32, 36, 54, 65535, 65535}, 74, 65535},
	{{33, 36, 54, 65535, 65535}, 75, 65535},
	{{34, 54, 65535, 65535, 65535}, 76, 65535},
	{{35, 36, 54, 65535, 65535}, 77, 65535},
	{{52, 56, 65535, 65535, 65535}, 0, 65535},
	{{49, 68, 65535, 65535, 65535}, 78, 23},
	{{47, 48, 65535, 65535, 65535}, 80, 65535},
	{{49, 51, 55, 65535, 65535}, 81, 65535},
	{{61, 65535, 65535, 65535, 65535}, 0, 65535},
	{{62, 65535, 65535, 65535, 65535}, 0, 65535},
	{{51, 63, 65535, 65535, 65535}, 0, 65535},
	{{38, 65535, 65535, 65535, 65535}, 0, 46},
	{{39, 65535, 65535, 65535, 65535}, 0, 46},
	{{40, 65535, 65535, 65535, 65535}, 0, 46},
	{{41, 65535, 65535, 65535, 65535}, 0, 46},
	{{42, 65535, 65535, 65535, 65535}, 0, 46},
	{{64, 65535, 65535, 65535, 65535}, 90, 23},
	{{30, 36, 63, 65535, 65535}, 154, 65535},
	{{31, 36, 63, 65535, 65535}, 155, 65535},
	{{32, 36, 63, 65535, 65535}, 156, 65535},
	{{33, 36, 63, 65535, 65535}, 157, 65535},
	{{34, 36, 63, 65535, 65535}, 158, 65535},
	{{35, 36, 63, 65535, 65535}, 159, 65535},
	{{30, 65, 66, 65535, 65535}, 162, 65535},
	{{31, 65, 66, 65535, 65535}, 163, 65535},
	{{32, 65, 66, 65535, 65535}, 164, 65535},
	{{33, 65, 66, 65535, 65535}, 165, 65535},
	{{34, 65, 66, 65535, 65535}, 166, 65535},
	{{35, 65, 66, 65535, 65535}, 167, 65535},
	{{70, 71, 65535, 65535, 65535}, 0, 65535},
	{{30, 65535, 65535, 65535, 65535}, 0, 65535},
	{{31, 65535, 65535, 65535, 65535}, 0, 65535},
	{{32, 65535, 65535, 65535, 65535}, 0, 65535},
	{{33, 65535, 65535, 65535, 65535}, 0, 65535},
	{{34, 65535, 65535, 65535, 65535}, 0, 65535},
	{{35, 65535, 65535, 65535, 65535}, 0, 65535},
	{{30, 67, 54, 65535, 65535}, 147, 65535},
	{{31, 67, 54, 65535, 65535}, 148, 65535},
	{{32, 67, 54, 65535, 65535}, 149, 65535},
	{{33, 67, 54, 65535, 65535}, 150, 65535},
	{{34, 67, 54, 65535, 65535}, 151, 65535},
	{{35, 67, 54, 65535, 65535}, 152, 65535},
	{{65535, 65535, 65535, 65535, 65535}, 1, 65535},
	{{87, 65535, 65535, 65535, 65535}, 0, 65535},
	{{82, 88, 65535, 65535, 65535}, 1, 65535},
	{{111, 105, 65535, 65535, 65535}, 0, 65535},
	{{114, 65535, 65535, 65535, 65535}, 0, 65535},
	{{101, 115, 106, 65535, 65535}, 0, 65535},
	{{116, 86, 93, 65535, 65535}, 0, 65535},
	{{118, 83, 84, 65535, 65535}, 0, 65535},
	{{104, 113, 89, 65535, 65535}, 0, 65535},
	{{92, 94, 97, 91, 65535}, 0, 65535},
	{{98, 96, 90, 95, 65535}, 0, 65535},
	{{90, 95, 65535, 65535, 65535}, 0, 65535},
	{{117, 79, 65535, 65535, 65535}, 0, 65535},
	{{78, 77, 85, 109, 65535}, 1, 65535},
	{{107, 65535, 65535, 65535, 65535}, 0, 65535},
	{{103, 110, 65535, 65535, 65535}, 0, 65535},
	{{99, 100, 65535, 65535, 65535}, 0, 65535},
	{{102, 112, 65535, 65535, 65535}, 0, 65535},
	{{119, 80, 81, 65535, 65535}, 1, 65535},
	{{108, 65535, 65535, 65535, 65535}, 1, 65535},
};

/** Translated audio feedback of events and user commands. */
const uint16 g_translatedVoice[][NUM_SPEECH_PARTS] = {
	{0x002B, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /*  0 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  1 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  2 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  3 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  4 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  5 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  6 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  7 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  8 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /*  9 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /* 10 */
	{0x0031, 0x001D, 0xFFFF, 0xFFFF, 0xFFFF}, /* 11 */
	{0x0031, 0x0032, 0xFFFF, 0xFFFF, 0xFFFF}, /* 12 */
	{0x0024, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 13 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 14 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 15 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 16 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 17 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 18 */
	{0x0037, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 19 */
	{0x0035, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 20 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 21 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 22 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 23 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 24 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 25 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 26 */
	{0x0025, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 27 */
	{0x002E, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 28 */
	{0x002D, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 29 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 30 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 31 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 32 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 33 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 34 */
	{0x0036, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 35 */
	{0x0034, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 36 */
	{0x0031, 0x0044, 0xFFFF, 0xFFFF, 0xFFFF}, /* 37 */
	{0x002F, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 38 */
	{0x0031, 0x0033, 0xFFFF, 0xFFFF, 0xFFFF}, /* 39 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 40 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 41 */
	{0x003F, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 42 */
	{0x0026, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 43 */
	{0x0027, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 44 */
	{0x0028, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 45 */
	{0x0029, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 46 */
	{0x002A, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 47 */
	{0x0040, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 48 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 49 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 50 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 51 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 52 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 53 */
	{0x0041, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 54 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 55 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 56 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 57 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 58 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 59 */
	{0x0042, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 60 */
	{0x0046, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 61 */
	{0x001E, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 62 */
	{0x001F, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 63 */
	{0x0020, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 64 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 65 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 66 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 67 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 68 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 69 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 70 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 71 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 72 */
	{0x0043, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 73 */
	{0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 74 */
	{0x0057, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 75 */
	{0x0052, 0x0058, 0xFFFF, 0xFFFF, 0xFFFF}, /* 76 */
	{0x006F, 0x0069, 0xFFFF, 0xFFFF, 0xFFFF}, /* 77 */
	{0x0072, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 78 */
	{0x0065, 0x0073, 0x006A, 0xFFFF, 0xFFFF}, /* 79 */
	{0x0074, 0x0056, 0x005D, 0xFFFF, 0xFFFF}, /* 80 */
	{0x0076, 0x0053, 0x0054, 0xFFFF, 0xFFFF}, /* 81 */
	{0x0068, 0x0071, 0x0059, 0xFFFF, 0xFFFF}, /* 82 */
	{0x005C, 0x005E, 0x0061, 0x005B, 0xFFFF}, /* 83 */
	{0x0062, 0x0060, 0xFFFF, 0xFFFF, 0xFFFF}, /* 84 */
	{0x005A, 0x005F, 0xFFFF, 0xFFFF, 0xFFFF}, /* 85 */
	{0x0075, 0x004F, 0xFFFF, 0xFFFF, 0xFFFF}, /* 86 */
	{0x004E, 0x004D, 0x0055, 0x006D, 0xFFFF}, /* 87 */
	{0x006B, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}, /* 88 */
	{0x0067, 0x006E, 0xFFFF, 0xFFFF, 0xFFFF}, /* 89 */
	{0x0063, 0x0064, 0xFFFF, 0xFFFF, 0xFFFF}, /* 90 */
	{0x0066, 0x0070, 0xFFFF, 0xFFFF, 0xFFFF}, /* 91 */
	{0x0077, 0x0050, 0x0051, 0xFFFF, 0xFFFF}, /* 92 */
	{0x006C, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF}  /* 93 */
};
