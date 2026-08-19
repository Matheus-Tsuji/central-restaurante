import { UserRepository } from '../repositories/UserRepository.js';
import { verifyPassword, generateToken, hashPassword } from '../utils/crypto.js';
import { User, UserRole } from '../models/types.js';
import { randomUUID } from 'node:crypto';

export class AuthService {
  static login(username: string, password: string): { user: Omit<User, 'password_hash'>; token: string } {
    const user = UserRepository.findByUsername(username);
    if (!user) {
      throw new Error('Usuário ou senha inválidos.');
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Usuário ou senha inválidos.');
    }

    const token = generateToken({
      userId: user.id,
      name: user.name,
      role: user.role
    });

    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  static createUser(name: string, username: string, role: UserRole, password: string): Omit<User, 'password_hash'> {
    const existing = UserRepository.findByUsername(username);
    if (existing) {
      throw new Error(`Nome de usuário '${username}' já está em uso.`);
    }

    const newUser = UserRepository.create({
      id: randomUUID(),
      name,
      username,
      role,
      password_hash: hashPassword(password)
    });

    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  static listUsers(): Omit<User, 'password_hash'>[] {
    return UserRepository.listAll();
  }
}
