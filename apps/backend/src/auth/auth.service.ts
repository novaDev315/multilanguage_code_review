import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create organization if name provided
    let organizationId: string;

    if (dto.organizationName) {
      const org = await this.prisma.organization.create({
        data: {
          name: dto.organizationName,
          planType: 'free',
        },
      });
      organizationId = org.id;
    } else {
      // Create default organization
      const org = await this.prisma.organization.create({
        data: {
          name: `${dto.name}'s Organization`,
          planType: 'free',
        },
      });
      organizationId = org.id;
    }

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hashedPassword,
        organizationId,
        role: 'admin',
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        organization: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          planType: user.organization.planType,
        },
      },
      ...tokens,
    };
  }

  async githubLogin(githubId: number, email: string, name: string, avatarUrl: string) {
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { githubId },
      include: { organization: true },
    });

    if (!user) {
      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link GitHub account to existing user
        user = await this.prisma.user.update({
          where: { email },
          data: {
            githubId,
            avatarUrl,
          },
          include: { organization: true },
        });
      } else {
        // Create new organization and user
        const org = await this.prisma.organization.create({
          data: {
            name: `${name}'s Organization`,
            planType: 'free',
          },
        });

        user = await this.prisma.user.create({
          data: {
            email,
            name,
            githubId,
            avatarUrl,
            organizationId: org.id,
            role: 'admin',
          },
          include: { organization: true },
        });
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          planType: user.organization.planType,
        },
      },
      ...tokens,
    };
  }

  async validateUser(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.validateUser(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
