// SkuttleWIFI.ino
#include "SkuttleWIFI.h"
#include <ArduinoOTA.h>
//#include <ESPmDNS.h>
#include "config.h" // Include the configuration header

SkuttleWIFI::SkuttleWIFI() : APserver(80) {}
long ptime = millis();
float maxUsedHeapPercentage = 0;
float maxUsedAudioStack = 0;
float maxUsedCamStack = 0;
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

void SkuttleWIFI::setupOTA() {
    _setupOTA();
 CreateTask();
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

void otaTask(void *parameter) {
    while (true) {
        ArduinoOTA.handle();
        vTaskDelay(20);  // Short delay to yield to other tasks
    }
}

void CreateTask() {
    xTaskCreatePinnedToCore(
        otaTask,       // Task function
        "OTATask",     // Name of the task
        2048,          // Stack size (in bytes)
        NULL,          // Task input parameter
        2,             // Priority of the task
        NULL,          // Task handle
        0              // Core where the task should run
    );
    Serial.println("OTATask Set");

    xTaskCreatePinnedToCore(
        flasherTask,       // Task function
        "FlasherTask",     // Name of the task
        2048,          // Stack size (in bytes)
        NULL,          // Task input parameter
        1,             // Priority of the task
        NULL,          // Task handle
        0              // Core where the task should run
    );
    Serial.println("Flasherask Set");
}

void flasherTask(void*parameter){
  while (true) {
    if (clientCommand != NULL){ // if we think we are connected...
      if (!clientCommand->status()){ // but really aren't...
        Serial.println("WebSocket client disconnected");
        //send stop command
      clientCommand = NULL;
      }else {// we are connected
        if ((millis() - ptime) > 3000){ // loop if 3 seconds have passed
          if ((millis() - ptime) > 3600){
            ptime = millis();
            heartbeat();
          }else if ((millis() - ptime) > 3400){
            digitalWrite(REDLIGHT, LOW); // turns on LED at 3.4
          }else if ((millis() - ptime) > 3200){
            digitalWrite(REDLIGHT, HIGH); // turns off LED at 3.2
          }else{
            digitalWrite(REDLIGHT, LOW); // turns on LED at 3.0
          }
        }
      }
    }else{ // no client
      if ((millis() - ptime) > 3000){
        if ((millis() - ptime) < 3200){
          digitalWrite(REDLIGHT, LOW); // LED on between 3.0 and 3.2 with no client
        }else{ // >3.2 with no client executes heartbeat
          ptime = millis();
          heartbeat();
        }  
      }  
    }
  }  
}

void handshake()
{
	String msg = String("handshake,") + MODULE + "," + ID;
	//Serial.println(msg);
	wsCommand.textAll(msg);
	ptime = millis();
	Serial.println ("sending handshake: "+msg);
}

void heartbeat()
{
// Get RSSI
    rssi = Signalchk.getRSSI();

    // Get heap usage information
    size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_8BIT);
    size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    size_t usedHeap = totalHeap - freeHeap;
    float usedHeapPercentage = (float)usedHeap / totalHeap * 100;

    // Update max used heap percentage
    if (usedHeapPercentage > maxUsedHeapPercentage) {
        maxUsedHeapPercentage = usedHeapPercentage;
    }

    // Get stack high water marks (minimum free stack space since the task started)
    /*UBaseType_t audioStackHighWaterMark = uxTaskGetStackHighWaterMark(audioTaskHandle);
    UBaseType_t camStackHighWaterMark = uxTaskGetStackHighWaterMark(camTaskHandle);

    // Calculate the used stack space as a percentage of the total stack size
    float maxUsedAudioStack = ((float)(audioStackHighWaterMark) / audiostacksize) * 100;
    float maxUsedAudioStack = ((float)(camStackHighWaterMark) / camstacksize) * 100;
*/
    // Create the command string
    String command = "RSSI(dBm): " + String(rssi) +
                     ", Used Heap(%): " + String(usedHeapPercentage, 2) +
                     ", Max Used Heap(%): " + String(maxUsedHeapPercentage, 2); /*+
                     ", Audio Stack(%): " + String(usedAudioStackPercentage, 2) +
                     ", Cam Stack(%): " + String(usedCamStackPercentage, 2);*/

    // Send the command via WebSocket
    wsCommand.textAll(command);

    // Print the command to the serial monitor
    Serial.println(command);

  digitalWrite(REDLIGHT, HIGH);
}
