import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates monthStartDay and returns the trimmed user shape', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        totpEnabled: false,
        monthStartDay: 23,
        passwordHash: 'secret-hash-should-not-leak',
      });

      const result = await service.update('user-1', { monthStartDay: 23 });

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { monthStartDay: 23 } });
      expect(result).toEqual({ id: 'user-1', email: 'a@example.com', totpEnabled: false, monthStartDay: 23 });
    });
  });
});
