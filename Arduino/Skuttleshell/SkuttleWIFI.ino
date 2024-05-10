// SkuttleWIFI.ino
#include "SkuttleWIFI.h"
#include <ArduinoOTA.h>
//#include <ESPmDNS.h>
#include "config.h" // Include the configuration header

SkuttleWIFI::SkuttleWIFI() : APserver(80) {}

void SkuttleWIFI::begin() {
    Serial.println("Initializing WiFi connection...");
    _connectToWiFi();
}

void SkuttleWIFI::_connectToWiFi() {
    Serial.print("Connecting to WiFi network: ");
    Serial.println(WIFI_SSID);
    // Start by trying to connect using predefined credentials
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long startAttemptTime = millis();
    // Attempt to connect for up to 10 seconds
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
        digitalWrite(REDLIGHT, !digitalRead(REDLIGHT));
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected successfully");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());

    } else {
        digitalWrite(REDLIGHT, LOW);
        Serial.println("\nFailed to connect with predefined credentials. Launching WiFiManager...");
        _initWiFiManager();
    }
}

void SkuttleWIFI::_initWiFiManager() {
    // Initialize the WiFi manager
    
    ESPAsync_WiFiManager wifiManager(&APserver, NULL);
    wifiManager.setConfigPortalTimeout(300); //time in seconds
    // Uncomment and adjust these as necessary for your setup
    // wifiManager.setAPStaticIPConfig(IPAddress(10,0,1,1), IPAddress(10,0,1,1), IPAddress(255,255,255,0));
    // wifiManager.setMinimumSignalQuality();

    // Set autoConnect timeout and start the portal

    if (!wifiManager.autoConnect("ESP32AP", "password")) {
      Serial.println("Failed to connect and hit timeout. Rebooting...");
      delay(3000); // 3 seconds delay before reboot
      ESP.restart();
    }
    // If you get here, you have connected to the WiFi network
    Serial.println("Connected to WiFi via WiFiManager");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    WiFi.mode(WIFI_STA);
    Serial.println("AP Server closed.");
}

void SkuttleWIFI::setupMDNS(const char* hostname) {
    Serial.print("Setting up mDNS for: ");
    Serial.println(hostname);
    bool mdnsStarted = MDNS.begin(hostname);
    int retries = 0;
    while (!mdnsStarted && retries < 5) { // Retry up to 5 times
        delay(1000); // Wait a second before retrying
        Serial.println("Retrying mDNS setup...");
        mdnsStarted = MDNS.begin(hostname);
        retries++;
    }
    if (mdnsStarted) {
        Serial.println("mDNS responder started successfully.");
    } else {
        Serial.println("Failed to start mDNS responder.");
    }
}

void SkuttleWIFI::_setupOTA() {
    ArduinoOTA.onStart([]() {
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) {
            type = "sketch";
        } else { // U_SPIFFS
            type = "filesystem";
        }
        Serial.println("Start updating " + type);
    });
    ArduinoOTA.onEnd([]() {
        Serial.println("\nEnd");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
        else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
        else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
        else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
        else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });
    ArduinoOTA.begin();
    Serial.println("OTA Ready");
}

void SkuttleWIFI::setupOTA() {
    _setupOTA();
}
