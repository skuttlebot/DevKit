#ifndef Signalchk_h
#define Signalchk_h

#include "Arduino.h"

class Signalchk {
public:
    Signalchk();
    void begin();
    long getRSSI();
};

#endif