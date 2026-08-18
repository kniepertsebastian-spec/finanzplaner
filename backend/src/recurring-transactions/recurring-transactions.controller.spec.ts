import { Test, TestingModule } from '@nestjs/testing';
import { RecurringTransactionsController } from './recurring-transactions.controller';
import { RecurringTransactionsService } from './recurring-transactions.service';

describe('RecurringTransactionsController', () => {
  let controller: RecurringTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringTransactionsController],
      providers: [{ provide: RecurringTransactionsService, useValue: {} }],
    }).compile();

    controller = module.get<RecurringTransactionsController>(RecurringTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
