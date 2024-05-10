#include "Signalchk.h"

Signalchk::Signalchk() {}

void Signalchk::begin() {
    // Initialization if needed
}

long Signalchk::getRSSI() {
    return WiFi.RSSI(); // Get the current RSSI of the connected network
}
