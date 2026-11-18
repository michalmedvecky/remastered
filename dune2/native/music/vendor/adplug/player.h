/* Dune II browser port modifications: 2026-11-18.
 * Changed for browser integration and/or V1.07 compatibility;
 * original copyright and license notices are retained below.
 */
/* Browser memory-provider adapter, replacing libbinio / AdPlug database glue.
 * The Westwood ADL interpreter in adl.cpp is retained. GPL-2.0-or-later.
 */
#ifndef DUNE_BROWSER_ADL_PLAYER_H
#define DUNE_BROWSER_ADL_PLAYER_H
#include <algorithm>
#include <cstring>
#include <string>
#include "opl.h"

class binistream {
public:
    const unsigned char *data;
    size_t size, position;
    binistream(const unsigned char *bytes, size_t length): data(bytes), size(length), position(0) {}
    void readString(char *target, size_t length) {
        const size_t available = std::min(length, size - position);
        std::memcpy(target, data + position, available);
        if (available < length) std::memset(target + available, 0, length - available);
        position += available;
    }
};

class CFileProvider {
public:
    const unsigned char *data;
    size_t size;
    CFileProvider(const unsigned char *bytes, size_t length): data(bytes), size(length) {}
    bool extension(const std::string &filename, const std::string &suffix) const {
        if (filename.size() < suffix.size()) return false;
        std::string tail = filename.substr(filename.size() - suffix.size());
        for (char &c: tail) if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        return tail == suffix;
    }
    binistream *open(const std::string &) const { return new binistream(data, size); }
    unsigned long filesize(binistream *stream) const { return stream->size; }
    void close(binistream *stream) const { delete stream; }
};

class CPlayer {
protected:
    Copl *opl;
public:
    explicit CPlayer(Copl *chip): opl(chip) {}
    virtual ~CPlayer() {}
};
#endif
