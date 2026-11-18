/* Exercise the exact heap boundary which exposed the native INI key overread. */
#include <assert.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include "types.h"
#include "ini.h"

/* The parser only needs trimming from the full game's string subsystem. */
void String_Trim(char *s)
{
	char *start = s;
	size_t n;
	while (isspace((unsigned char)*start)) start++;
	n = strlen(start);
	while (n && isspace((unsigned char)start[n - 1])) n--;
	memmove(s, start, n);
	s[n] = '\0';
}

static void check(const char *text, const char *key, const char *expected)
{
	/* Exact-sized allocation deliberately leaves no zero-padding after NUL. */
	char *source = malloc(strlen(text) + 1);
	char dest[256];
	strcpy(source, text);
	Ini_GetString("opendune", key, "DEFAULT", dest, sizeof(dest), source);
	assert(strcmp(dest, expected) == 0);
	free(source);
}

int main(void)
{
	check("[opendune]\nlanguage=english\n", "debug_skip_dialogs", "DEFAULT");
	check("[opendune]\nlanguage=english", "debug_skip_dialogs", "DEFAULT");
	check("[opendune]\na\n", "a_very_long_absent_key_at_the_heap_boundary", "DEFAULT");
	check("[opendune]\nx=1\n[next]\ndebug_skip_dialogs=7\n", "debug_skip_dialogs", "DEFAULT");
	check("[OPENDUNE]\nLanguage = english\n", "language", "english");
	check("[opendune]\naaa=wrong\naa = right\n", "aa", "right");
	check("[opendune]\nlanguage=english\nscalefactor=1\n", "scalefactor", "1");
	check("[opendune]\nlanguage=english\n", "language", "english");
	return 0;
}
