/* Compatibility arithmetic transcribed from the supplied DUNE2.EXE V1.07.
 * Evidence and limits: ../../COMBAT-FIDELITY.md. No original code is executed.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
#ifndef DUNE107_COMPAT_H
#define DUNE107_COMPAT_H

#include "types.h"

/* Avoid implementation-defined signed word conversion and right shift. */
static int32 Dune107_SignedWord(uint16 value)
{
	return value < 0x8000 ? (int32)value : (int32)value - 0x10000;
}

static int32 Dune107_ArithmeticHalf(int32 value)
{
	return value < 0 ? -((-value + 1) / 2) : value / 2;
}

/* 0x15d2f: SAR-rounded half-steps are applied twice at the extremes.
 * inverseSpeed has OpenDUNE's meaning, the inverse of original argument 4.
 */
static uint16 Dune107_AdjustToGameSpeed(uint16 normal, uint16 minimum,
	uint16 maximum, bool inverseSpeed, uint16 gameSpeed)
{
	int32 value = Dune107_SignedWord(normal);
	int32 low = Dune107_SignedWord(minimum);
	int32 high = Dune107_SignedWord(maximum);
	int32 twice = Dune107_SignedWord((uint16)(normal * 2U));
	int32 down, up;

	if (gameSpeed == 2) return normal;
	if (twice < high) high = twice;
	if (low < Dune107_ArithmeticHalf(value)) low = Dune107_ArithmeticHalf(value);
	down = Dune107_ArithmeticHalf(Dune107_SignedWord((uint16)(value - low)));
	up = Dune107_ArithmeticHalf(Dune107_SignedWord((uint16)(high - value)));
	if (inverseSpeed) gameSpeed = (uint16)(4 - gameSpeed);
	switch (gameSpeed) {
		case 0: value = Dune107_SignedWord((uint16)(value - down)); /* fall through */
		case 1: value = Dune107_SignedWord((uint16)(value - down)); break;
		case 4: value = Dune107_SignedWord((uint16)(value + up)); /* fall through */
		case 3: value = Dune107_SignedWord((uint16)(value + up)); break;
		default: break;
	}
	if (value > high) value = high;
	if (value < low) value = low;
	return (uint16)value;
}

/* 0x786e5: original fixed-point ratio, including word denominator wrapping. */
static uint16 Dune107_Ratio(uint16 numerator, uint16 denominator)
{
	uint32 scaled = (uint32)numerator << 8;
	while (scaled >= 0x10000UL) {
		scaled = (scaled + 1) >> 1;
		denominator = (uint16)((uint16)(denominator + 1U) >> 1);
	}
	return denominator == 0 ? 0xFFFF : (uint16)(scaled / denominator);
}

/* 0x786b9: rounded 8.8 multiply, saturated when the result exceeds a word. */
static uint16 Dune107_Scale(uint16 value, uint16 factor)
{
	uint32 product = (uint32)value * factor + 0x80;
	return product >= 0x1000000UL ? 0xFFFF : (uint16)(product >> 8);
}

#endif
