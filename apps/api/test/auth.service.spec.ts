import type { Request, Response } from "express";
import { AuthService } from "../src/services/auth.service";

function fakeResponse() {
  const cookies: Record<string, string> = {};
  const res = {
    cookie: (name: string, value: string) => {
      cookies[name] = value;
    },
    clearCookie: (name: string) => {
      delete cookies[name];
    },
    cookies
  };
  return res as unknown as Response & { cookies: Record<string, string> };
}

function requestWithCookie(value?: string) {
  return {
    headers: { cookie: value ? `smartagenda_session=${value}` : undefined }
  } as unknown as Request;
}

describe("AuthService - sessao com papeis", () => {
  const auth = new AuthService({} as never);

  it("sessao de profissional da equipe carrega teamMemberId e bloqueia requireOwner", () => {
    const res = fakeResponse();
    auth.createSession(res, "pro-1", "tm-1");
    const req = requestWithCookie(res.cookies["smartagenda_session"]);

    expect(auth.requireSession(req)).toEqual({ professionalId: "pro-1", teamMemberId: "tm-1" });
    expect(auth.requireProfessionalId(req)).toBe("pro-1");
    expect(() => auth.requireOwner(req)).toThrow();
  });

  it("sessao de dono (empresa) passa no requireOwner", () => {
    const res = fakeResponse();
    auth.createSession(res, "pro-2");
    const req = requestWithCookie(res.cookies["smartagenda_session"]);

    expect(auth.requireOwner(req)).toBe("pro-2");
    expect(auth.requireSession(req).teamMemberId).toBeUndefined();
  });

  it("sem cookie valido, requireSession lanca", () => {
    expect(() => auth.requireSession(requestWithCookie())).toThrow();
    expect(() => auth.requireSession(requestWithCookie("token-invalido"))).toThrow();
  });

  it("authenticateTeamMember valida a senha", async () => {
    const passwordHash = await auth.hashPassword("Segredo@123");
    const database = {
      findTeamMemberByEmail: async () => ({
        id: "tm-1",
        professional_id: "pro-1",
        name: "Maria",
        email: "maria@example.com",
        active: true,
        password_hash: passwordHash
      })
    };
    const authWithDb = new AuthService(database as never);

    expect(await authWithDb.authenticateTeamMember("maria@example.com", "Segredo@123")).toMatchObject({
      id: "tm-1",
      professional_id: "pro-1"
    });
    expect(await authWithDb.authenticateTeamMember("maria@example.com", "errada")).toBeUndefined();
  });

  it("login por empresa escopa o e-mail (nao mistura entre empresas)", async () => {
    const passwordHash = await auth.hashPassword("Segredo@123");
    const database = {
      // O membro pertence a empresa pro-A; busca escopada a outra empresa nao acha.
      findTeamMemberByEmail: async (_email: string, professionalId?: string) =>
        professionalId && professionalId !== "pro-A"
          ? undefined
          : {
              id: "tm-1",
              professional_id: "pro-A",
              name: "Maria",
              email: "maria@example.com",
              active: true,
              password_hash: passwordHash
            }
    };
    const authWithDb = new AuthService(database as never);

    expect(
      await authWithDb.authenticateTeamMember("maria@example.com", "Segredo@123", "pro-A")
    ).toMatchObject({ professional_id: "pro-A" });
    expect(
      await authWithDb.authenticateTeamMember("maria@example.com", "Segredo@123", "pro-B")
    ).toBeUndefined();
  });
});
