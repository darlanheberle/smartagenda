import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import { promisify } from "util";
import { DatabaseService } from "./database.service";

type SessionPayload = {
  professionalId: string;
  expiresAt: number;
};

const scrypt = promisify(scryptCallback);
const sessionCookieName = "smartagenda_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly secret: string;

  constructor(private readonly database: DatabaseService) {
    this.secret =
      process.env.AUTH_SECRET ||
      (process.env.NODE_ENV === "production" ? "" : "smartagenda-development-secret");

    if (!this.secret) {
      throw new Error("AUTH_SECRET precisa estar configurado em producao.");
    }
  }

  async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString("hex")}`;
  }

  async verifyPassword(password: string, storedHash?: string | null) {
    if (!storedHash) {
      return false;
    }

    const [algorithm, salt, expectedHex] = storedHash.split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHex) {
      return false;
    }

    const expected = Buffer.from(expectedHex, "hex");
    const derivedKey = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
  }

  async authenticate(email: string, password: string) {
    const professional = await this.database.findProfessionalByGmail(email);
    const passwordValid = await this.verifyPassword(password, professional?.password_hash);

    if (!professional || !passwordValid) {
      throw new UnauthorizedException("Email ou senha incorretos.");
    }

    return professional;
  }

  createSession(response: Response, professionalId: string) {
    const expiresAt = Date.now() + sessionDurationMs;
    const payload = this.encode({
      professionalId,
      expiresAt
    });
    const signature = this.sign(payload);

    response.cookie(sessionCookieName, `${payload}.${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: "/",
      maxAge: sessionDurationMs
    });
  }

  clearSession(response: Response) {
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: "/"
    });
  }

  requireProfessionalId(request: Request) {
    const token = this.readCookie(request, sessionCookieName);
    const session = token ? this.verifySession(token) : undefined;

    if (!session) {
      throw new UnauthorizedException("Faca login para acessar o painel.");
    }

    return session.professionalId;
  }

  requireOwnProfessional(request: Request, requestedProfessionalId?: string) {
    const professionalId = this.requireProfessionalId(request);

    if (requestedProfessionalId && requestedProfessionalId !== professionalId) {
      throw new UnauthorizedException("A sessao nao possui acesso a este profissional.");
    }

    return professionalId;
  }

  private verifySession(token: string): SessionPayload | undefined {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
      return undefined;
    }

    const expectedSignature = this.sign(payload);
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return undefined;
    }

    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
      return session.expiresAt > Date.now() ? session : undefined;
    } catch {
      return undefined;
    }
  }

  private encode(payload: SessionPayload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  private sign(payload: string) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  private readCookie(request: Request, name: string) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(";")) {
      const [cookieName, ...valueParts] = cookie.trim().split("=");
      if (cookieName === name) {
        return decodeURIComponent(valueParts.join("="));
      }
    }

    return undefined;
  }
}
