import { Test, TestingModule } from '@nestjs/testing';
import { SavingsPotsController } from './savings-pots.controller';
import { SavingsPotsService } from './savings-pots.service';

describe('SavingsPotsController', () => {
  let controller: SavingsPotsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsPotsController],
      providers: [{ provide: SavingsPotsService, useValue: {} }],
    }).compile();

    controller = module.get<SavingsPotsController>(SavingsPotsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
