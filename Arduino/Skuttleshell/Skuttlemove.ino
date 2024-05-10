//Skuttlemove handles the movements
#include "Skuttlemove.h"
#include <ESP32Servo.h>
#include <math.h>

bool MPRESSED = false;
bool RON = false;
bool LON = false;
bool TON = false;
const int RWPIN = 12; // Drive Servo 1 (right) Pin
const int LWPIN = 13; // Drive Servo 2 (left) Pin
const int CTPIN = 15; // Tilt Servo Pin
const int NUM_MODES = 3; // Number of mode
const String MODES[] = {"turret", "tank", "car"};

int mag =0;
int MODE = 0;
int posVal = 0;
int ttime = millis();
int rwtime = millis();
int lwtime = millis();
int tpos = 0;
int rmag =0;
int lmag =0;
int lpos=90;
int rpos=90;
float angle=0;
int angled=0;
Servo Rwheel;
Servo Lwheel;
Servo CamTilt;

void Skuttlemove::setup(){
  Rwheel.attach(RWPIN);
  Lwheel.attach(LWPIN);
  CamTilt.attach(CTPIN);
  Rwheel.write(90); // Initial position
  Lwheel.write(90); // Initial position
  CamTilt.write(0); // Initial position
  delay(3000);
  Serial.println("servos Initialized");
  Rwheel.detach();
  Lwheel.detach();
  CamTilt.detach();  
}

// Function implementation of the action function
void Skuttlemove::action(bool COMMAND[], float MOVE[]) {
  if(!TON){
    CamTilt.attach(CTPIN);
    CamTilt.write(20);
    Serial.println("tilt attached");
    TON=true;
  }
  //mode0 -TURRET-
  if (MODE == 0) { 
    mag=15; 
    if (COMMAND[15]) { //pivot right
      rpos=90-mag;
      lpos=90+mag;
    }else if (COMMAND[14]) { //pivot left
      rpos=90+mag;
      lpos=90-mag;
    }else{
      rpos=90;
      lpos=90;
    }
    LWspin(int(lpos));
    RWspin(int(rpos));
  }
  //mode1 -TANK-
  else if (MODE == 1) {  
    LWspin(int(90-30*MOVE[1])); //y axis inverted
    RWspin(int(90-30*MOVE[3])); // y axis inverted
  }
  //mode2  -CAR-
  else if (MODE == 2) {  
    float xin=MOVE[2];
    float yin=-MOVE[3];
    float mag=sqrt(xin*xin+yin*yin);
    if(mag>1){mag=1;}
    if(mag==0){
      rpos=90;
      lpos=90;
    } else if(xin>0) { //joystick right
      if(yin>0) { //joystick up/right
        lpos=(90+30*mag);
        rpos=(90+mag*(30-60*xin));
      } else { //joystick down/right
        rpos=(90-30*mag);
        lpos=(90-mag*(30-60*xin));
      }
    } else { //joystick left
      angled =atan(yin/xin)*180/M_PI;
      //Serial.println(angle);
      angle = atan(yin/xin);
      if(yin>0) { //joystick up/left
        rpos=(90+30*mag);
        lpos=(90+mag*(30+60*xin));
      } else { //joystick down/left
        lpos=(90-30*mag);
        rpos=(90-mag*(30+60*xin));
      }
    }
    Serial.println(String(xin) +" "+String(yin) +" "+String(mag) +" "+String(angled) +" "+String(lpos) +" "+String(rpos) );
    RWspin(rpos);
    LWspin(lpos);
  }
  if (COMMAND[12]) { tilt(1);}
  if (COMMAND[13]) { tilt(-1);}
  //mode change
  if (COMMAND[8]) { MPRESSED=true;}
  if (MPRESSED) {
    if(!COMMAND[8]) {
      MODE = (MODE + 1) % NUM_MODES; // Use modulo to cycle through modes
      Serial.println("mode " + String(MODE) + ": " + MODES[MODE]); 
      MPRESSED = false;
    }
  }
}

void tilt(int tmag) {
  if (millis() - ttime > 50) {
    tpos = constrain(tpos + tmag, 7, 67);
    CamTilt.write(tpos);
    String msg = "cam pos: " + String(tpos);
    Serial.println(msg);
    wsCommand.textAll(msg);
    ttime = millis();
  }
}

void RWspin(int mag) {
  if (mag == 90) {
    if (RON) {
      Rwheel.detach();
      RON = false;
      //Serial.println("Right Disconnected");
    }
  } else {
    if (!RON) {
      Rwheel.attach(RWPIN);
      RON = true;
    } 
    Rwheel.write(90-(mag-90));
  }
}

void LWspin(int mag) {
  if (mag == 90) {
    if (LON) {
      Lwheel.detach();
      //Serial.println("Left Disconnected");
      LON = false; 
    }
  } else {
    if (!LON) {
      Lwheel.attach(LWPIN);
      LON = true;
    } 
    Lwheel.write(mag);
  }
}
