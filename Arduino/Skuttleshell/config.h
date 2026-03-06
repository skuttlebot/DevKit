#ifndef CONFIG_H
#define CONFIG_H

// ─── Unit Type ───────────────────────────────────────────────────────────────
// Uncomment exactly one:
#define UNIT_TYPE_INTEGRATED
// #define UNIT_TYPE_HEAD
// #define UNIT_TYPE_BODY

// ─── Feature Flags (set per unit type) ───────────────────────────────────────
#define HAS_CAMERA
#define HAS_AUDIO_OUT
// #define HAS_AUDIO_IN     // uncomment when INMP441 is wired
// #define HAS_ESPNOW_TX    // head transmits to body
// #define HAS_ESPNOW_RX    // body receives from head

// ─── Serial Bus Servo IDs ────────────────────────────────────────────────────
#define SERVO_RIGHT_ID  1   // continuous rotation - right wheel
#define SERVO_LEFT_ID   2   // continuous rotation - left wheel
#define SERVO_TILT_ID   3   // positional - camera tilt

// ─── Board Pins (Freenove ESP32-S3-CAM) ──────────────────────────────────────
#define STATUS_LED       48   // WS2812 RGB - digitalWrite is no-op, NeoPixel library needed for color
#define SERVO_UART_TX    38   // Serial bus servo TX
#define SERVO_UART_RX    39   // Serial bus servo RX
#define I2S_BCLK         14   // I2S audio bit clock
#define I2S_LRC           2   // I2S audio word select (LRC)
#define I2S_DOUT         21   // I2S audio data out to amp (moved from GPIO15 - camera XCLK conflict)
// INMP441 mic - uncomment HAS_AUDIO_IN above when wired:
// SCK shares I2S_BCLK (14), WS shares I2S_LRC (2), SD on:
#define I2S_MIC_SD       40   // I2S mic data in (INMP441 SD pin)

// ─── WiFi Credentials ────────────────────────────────────────────────────────
// WARNING: do not commit real credentials - use config.h.template as reference
//#define WIFI_SSID  "PredatorW6-8svG-2.4GHz"
//#define WIFI_PASSWORD  "ConnectifUK"
//#define WIFI_SSID "OG Cares Labs"
//#define WIFI_PASSWORD "OurGenerationCare$"
#define WIFI_SSID "ExLabs1"
#define WIFI_PASSWORD "Wecatchasteroids"

// ─── Device Identity ─────────────────────────────────────────────────────────
#define MODULE  "SkuttleCommandMK2"
#define ID "SC0001"

#endif