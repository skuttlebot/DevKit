#ifndef SKUTTLEMOVE_H
#define SKUTTLEMOVE_H


class Skuttlemove {
public:
  void setup();
  void action(bool COMMAND[], float MOVE[]);

};

extern bool COMMAND[17];
extern float MOVE[4];

#endif
