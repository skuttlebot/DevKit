#ifndef SkuttleWIFI_h
#define SkuttleWIFI_h

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsync_WiFiManager.h>
//#include <functional>
extern AsyncWebSocket wsCommand;

class SkuttleWIFI {
public:
    SkuttleWIFI();
    void begin();
    void setupMDNS(const char* hostname); // Method to set up mDNS
    void setupOTA();
    void handshake();
private:
  AsyncWebServer APserver; 
    void _connectToWiFi(); // Private method to handle WiFi connection logic
    void _initWiFiManager();// Private method to initialize WiFiManager
    void _setupOTA();
    char autossid[32];
    char autopass[64];
};
     

#endif