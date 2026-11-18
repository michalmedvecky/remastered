/* Pure landscape oracle derived from GPL-2.0 OpenDUNE; modified 2026-11-18.
 * See COPYING.OpenDUNE. No DOS game code is executed by this host-only fixture generator.
 */
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
typedef uint8_t uint8; typedef int8_t int8; typedef uint16_t uint16; typedef int16_t int16; typedef uint32_t uint32;
#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))
#define lengthof(a) (sizeof(a)/sizeof((a)[0]))
enum{LST_NORMAL_SAND=0,LST_ENTIRELY_DUNE=2,LST_ENTIRELY_ROCK=4,LST_ENTIRELY_MOUNTAIN=6,LST_SPICE=8,LST_THICK_SPICE=9,LST_CONCRETE_SLAB=10,LST_WALL=11,LST_STRUCTURE=12,LST_DESTROYED_WALL=13,LST_BLOOM_FIELD=14};
typedef struct{uint16 x,y;}tile32;
typedef struct{uint32 groundTileID:9,overlayTileID:7,houseID:3,isUnveiled:1,hasUnit:1,hasStructure:1,hasAnimation:1,hasExplosion:1,index:8;}Tile;
typedef struct{bool canBecomeSpice;}LandscapeInfo;
static Tile g_map[4096+512]; static uint16 g_mapTileID[4096],nativeTypes[4096],g_iconMap[743];
static LandscapeInfo g_table_landscapeInfo[15];static uint8 s_randomSeed[4];static uint32 randomDraws;
static uint16 g_veiledTileID=0;
static uint16 g_builtSlabTileID=126,g_bloomTileID=208,g_wallTileID=33,g_landscapeTileID=127;
static int16 g_table_mapDiff[4]={-64,1,64,-1};static bool g_debugScenario=false;
static void *Structure_Get_ByPackedTile(uint16 packed){(void)packed;return NULL;}
static void Map_Update(uint16 packed,int type,bool ignore){(void)packed;(void)type;(void)ignore;}
static void Map_MarkTileDirty(uint16 packed){(void)packed;}
#define HOUSE_HARKONNEN 0
#define ICM_ICONGROUP_LANDSCAPE 9
static uint16 Tile_PackXY(uint16 x,uint16 y){return x|(y<<6);}
static uint16 Tile_GetPackedX(uint16 p){return p&63;}
static uint16 Tile_GetPackedY(uint16 p){return (p>>6)&63;}
static bool Tile_IsOutOfMap(uint16 p){return(p&0xf000)!=0;}
static uint16 Tile_GetX(tile32 t){return t.x;}static uint16 Tile_GetY(tile32 t){return t.y;}
static tile32 Tile_Center(tile32 t){t.x=(t.x&0xff00)|128;t.y=(t.y&0xff00)|128;return t;}
static uint16 Tile_PackTile(tile32 t){return(t.x>>8)|((t.y>>8)<<6);}
static const int8 _stepX[256] = {
	   0,    3,    6,    9,   12,   15,   18,   21,   24,   27,   30,   33,   36,   39,   42,   45,
	  48,   51,   54,   57,   59,   62,   65,   67,   70,   73,   75,   78,   80,   82,   85,   87,
	  89,   91,   94,   96,   98,  100,  101,  103,  105,  107,  108,  110,  111,  113,  114,  116,
	 117,  118,  119,  120,  121,  122,  123,  123,  124,  125,  125,  126,  126,  126,  126,  126,
	 127,  126,  126,  126,  126,  126,  125,  125,  124,  123,  123,  122,  121,  120,  119,  118,
	 117,  116,  114,  113,  112,  110,  108,  107,  105,  103,  102,  100,   98,   96,   94,   91,
	  89,   87,   85,   82,   80,   78,   75,   73,   70,   67,   65,   62,   59,   57,   54,   51,
	  48,   45,   42,   39,   36,   33,   30,   27,   24,   21,   18,   15,   12,    9,    6,    3,
	   0,   -3,   -6,   -9,  -12,  -15,  -18,  -21,  -24,  -27,  -30,  -33,  -36,  -39,  -42,  -45,
	 -48,  -51,  -54,  -57,  -59,  -62,  -65,  -67,  -70,  -73,  -75,  -78,  -80,  -82,  -85,  -87,
	 -89,  -91,  -94,  -96,  -98, -100, -102, -103, -105, -107, -108, -110, -111, -113, -114, -116,
	-117, -118, -119, -120, -121, -122, -123, -123, -124, -125, -125, -126, -126, -126, -126, -126,
	-126, -126, -126, -126, -126, -126, -125, -125, -124, -123, -123, -122, -121, -120, -119, -118,
	-117, -116, -114, -113, -112, -110, -108, -107, -105, -103, -102, -100,  -98,  -96,  -94,  -91,
	 -89,  -87,  -85,  -82,  -80,  -78,  -75,  -73,  -70,  -67,  -65,  -62,  -59,  -57,  -54,  -51,
	 -48,  -45,  -42,  -39,  -36,  -33,  -30,  -27,  -24,  -21,  -18,  -15,  -12,   -9,   -6,   -3
};
static const int8 _stepY[256] = {
	 127,  126,  126,  126,  126,  126,  125,  125,  124,  123,  123,  122,  121,  120,  119,  118,
	 117,  116,  114,  113,  112,  110,  108,  107,  105,  103,  102,  100,   98,   96,   94,   91,
	  89,   87,   85,   82,   80,   78,   75,   73,   70,   67,   65,   62,   59,   57,   54,   51,
	  48,   45,   42,   39,   36,   33,   30,   27,   24,   21,   18,   15,   12,    9,    6,    3,
	   0,   -3,   -6,   -9,  -12,  -15,  -18,  -21,  -24,  -27,  -30,  -33,  -36,  -39,  -42,  -45,
	 -48,  -51,  -54,  -57,  -59,  -62,  -65,  -67,  -70,  -73,  -75,  -78,  -80,  -82,  -85,  -87,
	 -89,  -91,  -94,  -96,  -98, -100, -102, -103, -105, -107, -108, -110, -111, -113, -114, -116,
	-117, -118, -119, -120, -121, -122, -123, -123, -124, -125, -125, -126, -126, -126, -126, -126,
	-126, -126, -126, -126, -126, -126, -125, -125, -124, -123, -123, -122, -121, -120, -119, -118,
	-117, -116, -114, -113, -112, -110, -108, -107, -105, -103, -102, -100,  -98,  -96,  -94,  -91,
	 -89,  -87,  -85,  -82,  -80,  -78,  -75,  -73,  -70,  -67,  -65,  -62,  -59,  -57,  -54,  -51,
	 -48,  -45,  -42,  -39,  -36,  -33,  -30,  -27,  -24,  -21,  -18,  -15,  -12,   -9,   -6,   -3,
	   0,    3,    6,    9,   12,   15,   18,   21,   24,   27,   30,   33,   36,   39,   42,   45,
	  48,   51,   54,   57,   59,   62,   65,   67,   70,   73,   75,   78,   80,   82,   85,   87,
	  89,   91,   94,   96,   98,  100,  101,  103,  105,  107,  108,  110,  111,  113,  114,  116,
	 117,  118,  119,  120,  121,  122,  123,  123,  124,  125,  125,  126,  126,  126,  126,  126
};
void Tools_Random_Seed(uint32 seed)
{
	s_randomSeed[0] = (seed >>  0) & 0xFF;
	s_randomSeed[1] = (seed >>  8) & 0xFF;
	s_randomSeed[2] = (seed >> 16) & 0xFF;
	s_randomSeed[3] = (seed >> 24) & 0xFF;
}
uint8 Tools_Random_256(void)
{
	randomDraws++;
	uint16 val16;
	uint8 val8;

	val16 = (s_randomSeed[1] << 8) | s_randomSeed[2];
	val8 = ((val16 ^ 0x8000) >> 15) & 1;
	val16 = (val16 << 1) | ((s_randomSeed[0] >> 1) & 1);
	val8 = (s_randomSeed[0] >> 2) - s_randomSeed[0] - val8;
	s_randomSeed[0] = (val8 << 7) | (s_randomSeed[0] >> 1);
	s_randomSeed[1] = val16 >> 8;
	s_randomSeed[2] = val16 & 0xFF;

	return s_randomSeed[0] ^ s_randomSeed[1];
}
tile32 Tile_UnpackTile(uint16 packed)
{
	tile32 tile;

	tile.x = (((packed >> 0) & 0x3F) << 8) | 0x80;
	tile.y = (((packed >> 6) & 0x3F) << 8) | 0x80;

	return tile;
}
uint16 Tile_GetDistancePacked(uint16 from, uint16 to)
{
    /* Supplied V1.07 0x1d819 does not mask packed Y before subtraction. */
    uint16 dx = abs((int)(from & 63) - (int)(to & 63));
    uint16 dy = abs((int)(from >> 6) - (int)(to >> 6));
    return max(dx, dy) + (min(dx, dy) >> 1);
}

#ifdef NATIVE_SAR
tile32 Tile_MoveByRandom(tile32 tile, uint16 distance, bool center)
{
	uint16 x;
	uint16 y;
	tile32 ret;
	uint8 orientation;
	uint16 newDistance;

	if (distance == 0) return tile;

	x = Tile_GetX(tile);
	y = Tile_GetY(tile);

	newDistance = Tools_Random_256();
	while (newDistance > distance) newDistance /= 2;
	distance = newDistance;

	orientation = Tools_Random_256();
	x += ((_stepX[orientation] * distance) >> 7) * 16;
	y += ((-_stepY[orientation] * distance) >> 7) * 16;

	if (x > 16384 || y > 16384) return tile;

	ret.x = x;
	ret.y = y;

	return center ? Tile_Center(ret) : ret;
}

#else
tile32 Tile_MoveByRandom(tile32 tile, uint16 distance, bool center)
{
	uint16 x;
	uint16 y;
	tile32 ret;
	uint8 orientation;
	uint16 newDistance;

	if (distance == 0) return tile;

	x = Tile_GetX(tile);
	y = Tile_GetY(tile);

	newDistance = Tools_Random_256();
	while (newDistance > distance) newDistance /= 2;
	distance = newDistance;

	orientation = Tools_Random_256();
	x += ((_stepX[orientation] * distance) / 128) * 16;
	y -= ((_stepY[orientation] * distance) / 128) * 16;

	if (x > 16384 || y > 16384) return tile;

	ret.x = x;
	ret.y = y;

	return center ? Tile_Center(ret) : ret;
}

#endif
static void Map_AddSpiceOnTile(uint16 packed)
{
	Tile *t;

	t = &g_map[packed];

	switch (t->groundTileID) {
		case LST_SPICE:
			t->groundTileID = LST_THICK_SPICE;
			Map_AddSpiceOnTile(packed);
			return;

		case LST_THICK_SPICE: {
			int8 i;
			int8 j;

			for (j = -1; j <= 1; j++) {
				for (i = -1; i <= 1; i++) {
					Tile *t2;
					uint16 packed2 = Tile_PackXY(Tile_GetPackedX(packed) + i, Tile_GetPackedY(packed) + j);

					if (Tile_IsOutOfMap(packed2)) continue;

					t2 = &g_map[packed2];

					if (!g_table_landscapeInfo[t2->groundTileID].canBecomeSpice) {
						t->groundTileID = LST_SPICE;
						continue;
					}

					if (t2->groundTileID != LST_THICK_SPICE) t2->groundTileID = LST_SPICE;
				}
			}
			return;
		}

		default:
			if (g_table_landscapeInfo[t->groundTileID].canBecomeSpice) t->groundTileID = LST_SPICE;
			return;
	}
}
static const uint16 _offsetTable[2][21][4] = {
	{
		{0, 0, 4, 0}, {4, 0, 4, 4}, {0, 0, 0, 4}, {0, 4, 4, 4}, {0, 0, 0, 2},
		{0, 2, 0, 4}, {0, 0, 2, 0}, {2, 0, 4, 0}, {4, 0, 4, 2}, {4, 2, 4, 4},
		{0, 4, 2, 4}, {2, 4, 4, 4}, {0, 0, 4, 4}, {2, 0, 2, 2}, {0, 0, 2, 2},
		{4, 0, 2, 2}, {0, 2, 2, 2}, {2, 2, 4, 2}, {2, 2, 0, 4}, {2, 2, 4, 4},
		{2, 2, 2, 4},
	},
	{
		{0, 0, 4, 0}, {4, 0, 4, 4}, {0, 0, 0, 4}, {0, 4, 4, 4}, {0, 0, 0, 2},
		{0, 2, 0, 4}, {0, 0, 2, 0}, {2, 0, 4, 0}, {4, 0, 4, 2}, {4, 2, 4, 4},
		{0, 4, 2, 4}, {2, 4, 4, 4}, {4, 0, 0, 4}, {2, 0, 2, 2}, {0, 0, 2, 2},
		{4, 0, 2, 2}, {0, 2, 2, 2}, {2, 2, 4, 2}, {2, 2, 0, 4}, {2, 2, 4, 4},
		{2, 2, 2, 4},
	},
};
void Map_CreateLandscape(uint32 seed)
{
	static const int8 around[] = {0, -1, 1, -16, 16, -17, 17, -15, 15, -2, 2, -32, 32, -4, 4, -64, 64, -30, 30, -34, 34};

	uint16 i;
	uint16 j;
	uint16 k;
	uint8  memory[273] = {0};
	uint16 currentRow[64];
	uint16 previousRow[64];
	uint16 spriteID1;
	uint16 spriteID2;
	uint16 *iconMap;

	Tools_Random_Seed(seed);

	/* Place random data on a 4x4 grid. */
	for (i = 0; i < 272; i++) {
		memory[i] = Tools_Random_256() & 0xF;
		if (memory[i] > 0xA) memory[i] = 0xA;
	}

	i = (Tools_Random_256() & 0xF) + 1;
	while (i-- != 0) {
		int16 base = Tools_Random_256();

		for (j = 0; j < lengthof(around); j++) {
			int16 index = min(max(0, base + around[j]), 272);

			memory[index] = (memory[index] + (Tools_Random_256() & 0xF)) & 0xF;
		}
	}

	i = (Tools_Random_256() & 0x3) + 1;
	while (i-- != 0) {
		int16 base = Tools_Random_256();

		for (j = 0; j < lengthof(around); j++) {
			int16 index = min(max(0, base + around[j]), 272);

			memory[index] = Tools_Random_256() & 0x3;
		}
	}

	for (j = 0; j < 16; j++) {
		for (i = 0; i < 16; i++) {
			g_map[Tile_PackXY(i * 4, j * 4)].groundTileID = memory[j * 16 + i];
		}
	}

	/* Average around the 4x4 grid. */
	for (j = 0; j < 16; j++) {
		for (i = 0; i < 16; i++) {
			for (k = 0; k < 21; k++) {
				const uint16 *offsets = _offsetTable[(i + 1) % 2][k];
				uint16 packed1;
				uint16 packed2;
				uint16 packed;
				uint16 sprite2;

				packed1 = Tile_PackXY(i * 4 + offsets[0], j * 4 + offsets[1]);
				packed2 = Tile_PackXY(i * 4 + offsets[2], j * 4 + offsets[3]);
				packed = (packed1 + packed2) / 2;

				if (Tile_IsOutOfMap(packed)) continue;

				packed1 = Tile_PackXY((i * 4 + offsets[0]) & 0x3F, j * 4 + offsets[1]);
				packed2 = Tile_PackXY((i * 4 + offsets[2]) & 0x3F, j * 4 + offsets[3]);
				assert(packed1 < 64 * 64);

				/* ENHANCEMENT -- use groundTileID=0 when out-of-bounds to generate the original maps. */
				if (packed2 < 64 * 64) {
					sprite2 = g_map[packed2].groundTileID;
				} else {
					sprite2 = 0;
				}

				g_map[packed].groundTileID = (g_map[packed1].groundTileID + sprite2 + 1) / 2;
			}
		}
	}

	memset(currentRow, 0, 128);

	/* Average each tile with its neighbours. */
	for (j = 0; j < 64; j++) {
		Tile *t = &g_map[j * 64];
		memcpy(previousRow, currentRow, 128);

		for (i = 0; i < 64; i++) currentRow[i] = t[i].groundTileID;

		for (i = 0; i < 64; i++) {
			uint16 neighbours[9];
			uint16 total = 0;

			neighbours[0] = (i == 0  || j == 0)  ? currentRow[i] : previousRow[i - 1];
			neighbours[1] = (           j == 0)  ? currentRow[i] : previousRow[i];
			neighbours[2] = (i == 63 || j == 0)  ? currentRow[i] : previousRow[i + 1];
			neighbours[3] = (i == 0)             ? currentRow[i] : currentRow[i - 1];
			neighbours[4] =                        currentRow[i];
			neighbours[5] = (i == 63)            ? currentRow[i] : currentRow[i + 1];
			neighbours[6] = (i == 0  || j == 63) ? currentRow[i] : t[i + 63].groundTileID;
			neighbours[7] = (           j == 63) ? currentRow[i] : t[i + 64].groundTileID;
			neighbours[8] = (i == 63 || j == 63) ? currentRow[i] : t[i + 65].groundTileID;

			for (k = 0; k < 9; k++) total += neighbours[k];
			t[i].groundTileID = total / 9;
		}
	}

	/* Filter each tile to determine its final type. */
	spriteID1 = Tools_Random_256() & 0xF;
	if (spriteID1 < 0x8) spriteID1 = 0x8;
	if (spriteID1 > 0xC) spriteID1 = 0xC;

	spriteID2 = (Tools_Random_256() & 0x3) - 1;
	if (spriteID2 > spriteID1 - 3) spriteID2 = spriteID1 - 3;

	for (i = 0; i < 4096; i++) {
		uint16 spriteID = g_map[i].groundTileID;

		if (spriteID > spriteID1 + 4) {
			spriteID = LST_ENTIRELY_MOUNTAIN;
		} else if (spriteID >= spriteID1) {
			spriteID = LST_ENTIRELY_ROCK;
		} else if (spriteID <= spriteID2) {
			spriteID = LST_ENTIRELY_DUNE;
		} else {
			spriteID = LST_NORMAL_SAND;
		}

		g_map[i].groundTileID = spriteID;
	}

	/* Add some spice. */
	i = Tools_Random_256() & 0x2F;
	while (i-- != 0) {
		tile32 tile;
		uint16 packed;

		while (true) {
			packed = Tools_Random_256() & 0x3F;
			packed = Tile_PackXY(Tools_Random_256() & 0x3F, packed);

			if (g_table_landscapeInfo[g_map[packed].groundTileID].canBecomeSpice) break;
		}

		tile = Tile_UnpackTile(packed);

		j = Tools_Random_256() & 0x1F;
		while (j-- != 0) {
			while (true) {
				tile32 unpacked = Tile_MoveByRandom(tile, Tools_Random_256() & 0x3F, true);
				packed = Tile_PackTile(unpacked);

				if (!Tile_IsOutOfMap(packed)) break;
			}

			Map_AddSpiceOnTile(packed);
		}
	}

	for (i = 0; i < 4096; i++) nativeTypes[i] = g_map[i].groundTileID;
	/* Make everything smoother and use the right sprite indexes. */
	for (j = 0; j < 64; j++) {
		Tile *t = &g_map[j * 64];

		memcpy(previousRow, currentRow, 128);

		for (i = 0; i < 64; i++) currentRow[i] = t[i].groundTileID;

		for (i = 0; i < 64; i++) {
			uint16 current = t[i].groundTileID;
			uint16 up      = (j == 0)  ? current : previousRow[i];
			uint16 right   = (i == 63) ? current : currentRow[i + 1];
			uint16 down    = (j == 63) ? current : t[i + 64].groundTileID;
			uint16 left    = (i == 0)  ? current : currentRow[i - 1];
			uint16 spriteID = 0;

			if (up    == current) spriteID |= 1;
			if (right == current) spriteID |= 2;
			if (down  == current) spriteID |= 4;
			if (left  == current) spriteID |= 8;

			switch (current) {
				case LST_NORMAL_SAND:
					spriteID = 0;
					break;
				case LST_ENTIRELY_ROCK:
					if (up    == LST_ENTIRELY_MOUNTAIN) spriteID |= 1;
					if (right == LST_ENTIRELY_MOUNTAIN) spriteID |= 2;
					if (down  == LST_ENTIRELY_MOUNTAIN) spriteID |= 4;
					if (left  == LST_ENTIRELY_MOUNTAIN) spriteID |= 8;
					spriteID++;
					break;
				case LST_ENTIRELY_DUNE:
					spriteID += 17;
					break;
				case LST_ENTIRELY_MOUNTAIN:
					spriteID += 33;
					break;
				case LST_SPICE:
					if (up    == LST_THICK_SPICE) spriteID |= 1;
					if (right == LST_THICK_SPICE) spriteID |= 2;
					if (down  == LST_THICK_SPICE) spriteID |= 4;
					if (left  == LST_THICK_SPICE) spriteID |= 8;
					spriteID += 49;
					break;
				case LST_THICK_SPICE:
					spriteID += 65;
					break;
				default: break;
			}

			t[i].groundTileID = spriteID;
		}
	}

	/* Finalise the tiles with the real sprites. */
	iconMap = &g_iconMap[g_iconMap[ICM_ICONGROUP_LANDSCAPE]];

	for (i = 0; i < 4096; i++) {
		Tile *t = &g_map[i];

		t->groundTileID  = iconMap[t->groundTileID];
		t->overlayTileID = g_veiledTileID;
		t->houseID       = HOUSE_HARKONNEN;
		t->isUnveiled    = false;
		t->hasUnit       = false;
		t->hasStructure  = false;
		t->hasAnimation  = false;
		t->hasExplosion  = false;
		t->index         = 0;
	}

	for (i = 0; i < 4096; i++) g_mapTileID[i] = g_map[i].groundTileID;
}
static const uint16 _landscapeSpriteMap[81] = {
	0, 1, 1, 1, 5, 1, 5, 5, 5, 5, /* Sprites 127-136 */
	5, 5, 5, 5, 5, 5, 4, 3, 3, 3, /* Sprites 137-146 */
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, /* Sprites 147-156 */
	3, 3, 2, 7, 7, 7, 7, 7, 7, 7, /* Sprites 157-166 */
	7, 7, 7, 7, 7, 7, 7, 7, 6, 8, /* Sprites 167-176 */
	8, 8, 8, 8, 8, 8, 8, 8, 8, 8, /* Sprites 177-186 */
	8, 8, 8, 8, 8, 9, 9, 9, 9, 9, /* Sprites 187-196 */
	9, 9, 9, 9, 9, 9, 9, 9, 9, 9, /* Sprites 197-206 */
	9,                            /* Sprite  207 (bloom sprites 208 and 209 are already caught). */
};
uint16 Map_GetLandscapeType(uint16 packed)
{
	Tile *t;
	int16 spriteOffset;

	if (packed >= 4096) return LST_ENTIRELY_ROCK; /* Explicit cleared-neighbor model. */
	t = &g_map[packed];

	if (t->groundTileID == g_builtSlabTileID) return LST_CONCRETE_SLAB;

	if (t->groundTileID == g_bloomTileID || t->groundTileID == g_bloomTileID + 1) return LST_BLOOM_FIELD;

	if (t->groundTileID > g_wallTileID && (uint16)t->groundTileID < g_wallTileID + 75) return LST_WALL;

	if (t->overlayTileID == g_wallTileID) return LST_DESTROYED_WALL;

	if (Structure_Get_ByPackedTile(packed) != NULL) return LST_STRUCTURE;

	spriteOffset = t->groundTileID - g_landscapeTileID; /* Offset in the landscape icon group. */
	if (spriteOffset < 0 || spriteOffset > 80) return LST_ENTIRELY_ROCK;

	return _landscapeSpriteMap[spriteOffset];
}
static void Map_FixupSpiceEdges(uint16 packed)
{
	uint16 type;
	uint16 spriteID;

	packed &= 0xFFF;
	type = Map_GetLandscapeType(packed);
	spriteID = 0;

	if (type == LST_SPICE || type == LST_THICK_SPICE) {
		uint8 i;

		for (i = 0; i < 4; i++) {
			const uint16 curPacked = packed + g_table_mapDiff[i];
			uint16 curType;

			if (false) { /* Native check masks coordinates before comparing; unreachable. */
				if (type == LST_SPICE || type == LST_THICK_SPICE) spriteID |= (1 << i);
				continue;
			}

			curType = Map_GetLandscapeType(curPacked);

			if (type == LST_SPICE) {
				if (curType == LST_SPICE || curType == LST_THICK_SPICE) spriteID |= (1 << i);
				continue;
			}

			if (curType == LST_THICK_SPICE) spriteID |= (1 << i);
		}

		spriteID += (type == LST_SPICE) ? 49 : 65;

		spriteID = g_iconMap[g_iconMap[ICM_ICONGROUP_LANDSCAPE] + spriteID] & 0x1FF;
		g_mapTileID[packed] = 0x8000 | spriteID;
		g_map[packed].groundTileID = spriteID;
	}

	Map_Update(packed, 0, false);
}
void Map_ChangeSpiceAmount(uint16 packed, int16 dir)
{
	uint16 type;
	uint16 spriteID;

	if (dir == 0) return;

	type = Map_GetLandscapeType(packed);

	if (type == LST_THICK_SPICE && dir > 0) return;
	if (type != LST_SPICE && type != LST_THICK_SPICE && dir < 0) return;
	if (type != LST_NORMAL_SAND && type != LST_ENTIRELY_DUNE && type != LST_SPICE && dir > 0) return;

	if (dir > 0) {
		type = (type == LST_SPICE) ? LST_THICK_SPICE : LST_SPICE;
	} else {
		type = (type == LST_THICK_SPICE) ? LST_SPICE : LST_NORMAL_SAND;
	}

	spriteID = 0;
	if (type == LST_SPICE) spriteID = 49;
	if (type == LST_THICK_SPICE) spriteID = 65;

	spriteID = g_iconMap[g_iconMap[ICM_ICONGROUP_LANDSCAPE] + spriteID] & 0x1FF;
	g_mapTileID[packed] = 0x8000 | spriteID;
	g_map[packed].groundTileID = spriteID;

	Map_FixupSpiceEdges(packed);
	Map_FixupSpiceEdges(packed + 1);
	Map_FixupSpiceEdges(packed - 1);
	Map_FixupSpiceEdges(packed - 64);
	Map_FixupSpiceEdges(packed + 64);
}
void Map_FillCircleWithSpice(uint16 packed, uint16 radius)
{
	uint16 x;
	uint16 y;
	int i;
	int j;

	if (radius == 0) return;

	x = Tile_GetPackedX(packed);
	y = Tile_GetPackedY(packed);

	for (i = -radius; i <= radius; i++) {
		for (j = -radius; j <= radius; j++) {
			uint16 curPacked = Tile_PackXY(x + j, y + i);
			uint16 distance  = Tile_GetDistancePacked(packed, curPacked);

			if (distance > radius) continue;

			if (distance == radius && (Tools_Random_256() & 1) == 0) continue;

			if (Map_GetLandscapeType(curPacked) == LST_SPICE) continue;

			Map_ChangeSpiceAmount(curPacked, 1);

			if (g_debugScenario) {
				Map_MarkTileDirty(curPacked);
			}
		}
	}

	Map_ChangeSpiceAmount(packed, 1);
}

static void map_parts(const char*list,int type){
 const char*s=list;
 while(*s){char*end;unsigned p=(unsigned)strtoul(s,&end,10);if(end==s||p>=4096)return;
 if(type==0){g_map[p].groundTileID=208;g_mapTileID[p]|=0x8000;}
 if(type==1)Map_FillCircleWithSpice(p,5);
 if(type==2){g_map[p].groundTileID=209;g_mapTileID[p]|=0x8000;}
 s=(*end==',')?end+1:end;}
}
int main(int argc,char**argv){
 if(argc!=2&&argc!=5)return 2;
 for(unsigned i=0;i<743;i++)g_iconMap[i]=0;
 g_iconMap[9]=154;for(unsigned i=0;i<83;i++)g_iconMap[154+i]=127+i;
 g_table_landscapeInfo[0].canBecomeSpice=true;g_table_landscapeInfo[2].canBecomeSpice=true;g_table_landscapeInfo[3].canBecomeSpice=true;g_table_landscapeInfo[8].canBecomeSpice=true;g_table_landscapeInfo[9].canBecomeSpice=true;
 Map_CreateLandscape((uint32)strtoull(argv[1],NULL,0));
 if(argc==5){map_parts(argv[2],0);map_parts(argv[3],1);map_parts(argv[4],2);}
 for(unsigned i=0;i<4096;i++){putchar(g_map[i].groundTileID&255);putchar(g_map[i].groundTileID>>8);}
 for(unsigned i=0;i<4096;i++){putchar(nativeTypes[i]&255);putchar(nativeTypes[i]>>8);}
 for(unsigned i=0;i<4096;i++){putchar(g_mapTileID[i]&255);putchar(g_mapTileID[i]>>8);}
 fwrite(s_randomSeed,1,4,stdout);for(unsigned i=0;i<4;i++)putchar((randomDraws>>(i*8))&255);
 return 0;
}
