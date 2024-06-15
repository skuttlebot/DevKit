//Skuttleshell is the central command structure
#include <Arduino.h> 
#include <WiFi.h>
#include <ESPAsyncWebServer.h>    
#include <ESPmDNS.h>
//ota
#include <WiFiUdp.h>
#include <ESPAsync_WiFiManager.h>
#include <ArduinoOTA.h>
//customs
#include "Skuttlemove.h"
#include "Skuttlecam.h"
#include "config.h"
#include "SkuttleWIFI.h"
#include "Signalchk.h" //wifi monitoring
#include "Skuttlesound.h"
//#define FLASHLIGHT 4//33-red 4-flash
#define REDLIGHT 33

SkuttleWIFI skuttleWIFI;  //instance of SkuttleWIFI class
Skuttlemove actionitem; // Create an instance of the Skuttlemove class
Skuttlecam skuttlecamInstance;  //instance of skuttlecam class
Signalchk Signalchk;
Skuttlesound skuttlesound; //instance for skuttlesound

AsyncWebServer server(8080);
AsyncWebSocket wsCommand("/Command");
AsyncWebSocket wsCamera("/Camera");
AsyncWebSocket wsSound("/Sound");
AsyncWebSocketClient *clientCommand = NULL; // To track the client connection

long ptime = millis(); //pulse timer
long mtime = millis();//motor timer
const int mintraval = 100;
long rssi;

bool COMMAND[17];
bool CAMON = false;
bool REDSTATE = false;
bool CPRESSED = false;
float MOVE[4];
int cameraClientId=0;
int SoundClientId=0;



void setup()
{
  pinMode(REDLIGHT, OUTPUT);
  Serial.begin(115200);
  Serial.println("Booting");

  skuttleWIFI.begin();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  skuttleWIFI.setupOTA();
  delay(300);

  skuttleWIFI.setupMDNS("skuttlehost");
  delay(300);
  SetupWSServer();
  Signalchk.begin();
  skuttlecamInstance.on();
  skuttlesound.begin();
  //audioSync = skuttlesound.getSync();
}

void loop()
{
  if(millis()-mtime >= mintraval){
    //sends last known command
    actionitem.action(COMMAND, MOVE);
    mtime=millis();

  }
  maintenance();//confirms connection
  if(CAMON && cameraClientId!=0){skuttlecamInstance.data();} 
  ArduinoOTA.handle();

  /*if (availableAudio > 0 && (millis()-lastAudioPlay)>=audioSync){
    Serial.println ("buffer size= "+ String(availableAudio)+ " elapsed time= "+ String(millis()-lastAudioPlay));
    skuttlesound.play();
    lastAudioPlay = millis();
  }*/
  
}

// Function to handle WebSocketCommand events
void onWebSocketEventCommand(AsyncWebSocket *server, AsyncWebSocketClient *client,
		AwsEventType type, void *arg, uint8_t *data, size_t len){
	String command;
	int index;
	String identifier;
	switch (type)
	{
    case WS_EVT_CONNECT:
      Serial.println("WebSocket Command client connected");
      clientCommand = client;
      handshake();
      break;
    case WS_EVT_DISCONNECT:
      Serial.println("WebSocket Command client disconnected");
      clientCommand=NULL;
      wsCommand.cleanupClients();
      //full stop routine!!!
      break;
    case WS_EVT_DATA:{

      // The data is received, parse and process it
      command = String((char*) data, len);
      index = command.indexOf(',');
      identifier = command.substring(0, index);
      Serial.printf("Data received: %s\n", command.c_str()); //("+");
      if (identifier.equals("command"))
      {
        // Skip the identifier and read the rest of the data
        command = command.substring(index + 1);
        // Parse the data and populate the arrays
        for (int i = 0; i < 21; i++)
        {
          index = command.indexOf(',');
          String element = command.substring(0, index);
          command = command.substring(index + 1);
          if (i < 17)
          {
            COMMAND[i] = element.toInt();
          }
          else
          {
            MOVE[i - 17] = element.toFloat();
          }
        }
        //camera server toggle
        if (COMMAND[9])
        {
          CPRESSED = true;
        }
        if (CPRESSED)
        {
          if (!COMMAND[9])//
          {
            CAMON = !CAMON;
            if (CAMON)    //
            {
              String msg = "camconnect";
              Serial.println(msg);//tells client to connect
              wsCommand.textAll(msg);
            }else {
              String msg = "camdisconnect";
              Serial.println(msg);//tells client to disconnect
              wsCommand.textAll(msg);
            }
            CPRESSED = false;
          }
        }
      }
      else if (identifier.equals("handshake"))
      {
        // Handle the handshake request
        command = command.substring(index + 1);
        index = command.indexOf(',');
        String Clientname = command.substring(0, index);
        String ClientSN = command.substring(index + 1);
        Serial.println(
            "recieved handshake: " + Clientname + ", " + ClientSN);
      }
      else if (identifier.equals("ping"))
      {     
        String msg = "pong";
        Serial.print(msg);
        wsCommand.textAll(msg);
      }
    } 
    break;
    
	default://handle other cases here
		break;
  }
}

// Function to handle WebSocketCamera events
void onWebSocketEventCamera(AsyncWebSocket *server, AsyncWebSocketClient *client,
      AwsEventType type, void *arg, uint8_t *data, size_t len)
{
   switch (type)
   {
      case WS_EVT_CONNECT:
         Serial.println("WebSocket Camera client connected");
         if(!CAMINIT){skuttlecamInstance.on();}
         cameraClientId = client->id();
  
         Serial.print("cameraClientID = ");
         Serial.println(cameraClientId);
         break;
      case WS_EVT_DISCONNECT:
         Serial.println("WebSocket Camera client disconnected");
         skuttlecamInstance.off();
         wsCamera.cleanupClients();
         cameraClientId = 0;
         break;
      case WS_EVT_DATA:
         // Currently no incoming data on this instance but might in the future (Sound)
         break;
      default:
        break;
      // Add other cases if needed
   }
}

// Function to handle WebSocketSound events
void onWebSocketEventSound(AsyncWebSocket *server, AsyncWebSocketClient *client,
      AwsEventType type, void *arg, uint8_t *data, size_t len)
{
   switch (type)
   {
      case WS_EVT_CONNECT:
         Serial.println("WebSocket Sound client connected");
         SoundClientId = client->id();
  
         Serial.print("SoundClientID = ");
         Serial.println(SoundClientId);
         break;
      case WS_EVT_DISCONNECT:
         Serial.println("WebSocket Sound client disconnected");
         break;
      case WS_EVT_DATA:{
        //Serial.println("time: "+String(millis())+", datalength: "+len);
        skuttlesound.addToBuffer(data, len);
        //String command =("~"); //String("heartbeat,") + MODULE + "," + ID;
        //wsCommand.textAll(command);
        //Serial.print(command);
         break;
      }
      default:
        break;
      // Add other cases if needed
   }
}
void heartbeat()
{
  rssi = Signalchk.getRSSI();
  String command =("RSSI(dBm): "+ String(rssi)); //String("heartbeat,") + MODULE + "," + ID;
  wsCommand.textAll(command);
  Serial.println(command);
  //Serial.println(command);
  //Serial.printf("SPIRam Total heap %d, SPIRam Free Heap %d\n", ESP.getPsramSize(), ESP.getFreePsram());
  digitalWrite(REDLIGHT, HIGH);
}

void handshake()
{
	String msg = String("handshake,") + MODULE + "," + ID;
	//Serial.println(msg);
	wsCommand.textAll(msg);
	float ptime = millis();
	Serial.println ("sending handshake: "+msg);
}

void maintenance(){
  if (clientCommand != NULL){ // if we think we are connected...
    if (!clientCommand->status()){ // but really aren't...
      Serial.println("WebSocket client disconnected");
      clientCommand = NULL;
    }
    else {// we are connected
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

void SetupWSServer() {
    server.addHandler(&wsCommand);
    wsCommand.onEvent(onWebSocketEventCommand);
    server.addHandler(&wsCamera);
    wsCamera.onEvent(onWebSocketEventCamera);
    server.addHandler(&wsSound);
    wsSound.onEvent(onWebSocketEventSound);
    Serial.println("WebSocket Handlers Set");
    server.begin();
    Serial.println("WebSocket Server Started");
}
