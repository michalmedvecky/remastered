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
