import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return { status: 'online', message: 'Finanz-PWA API läuft stabil!' };
  }
}
