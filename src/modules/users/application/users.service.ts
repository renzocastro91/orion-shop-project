import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/roles';
import { UserEntity } from '../domain/user.entity';

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  password?: string;
  role?: UserRole;
}

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  listBuyers() {
    return this.users.find({
      where: { role: UserRole.Buyer },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase();
    const exists = await this.findByEmail(email);
    if (exists) throw new ConflictException('El email ya esta registrado');

    const user = this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone ?? null,
      passwordHash: input.password ? await bcrypt.hash(input.password, 10) : null,
      role: input.role ?? UserRole.Buyer,
    });

    return this.users.save(user);
  }

  async updateProfile(id: string, input: UpdateProfileInput) {
    const user = await this.findById(id);
    const email = input.email.toLowerCase();

    if (email !== user.email) {
      const exists = await this.findByEmail(email);
      if (exists) throw new ConflictException('El email ya esta registrado');
    }

    user.firstName = input.firstName;
    user.lastName = input.lastName;
    user.email = email;
    user.phone = input.phone;

    if (input.password) {
      user.passwordHash = await bcrypt.hash(input.password, 10);
    }

    return this.users.save(user);
  }

  async setLoyaltyResetAt(id: string, resetAt: Date) {
    const user = await this.findById(id);
    user.loyaltyResetAt = resetAt;
    return this.users.save(user);
  }
}
