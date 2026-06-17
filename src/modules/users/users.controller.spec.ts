import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('findAll delegates to UsersService.findAll', () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new UsersController(service as unknown as UsersService);

    void controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });
});
