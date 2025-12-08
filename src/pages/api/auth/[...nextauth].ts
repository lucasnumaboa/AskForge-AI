import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { User, Permission, ModuleAccess, Module } from '@/types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const users = await query<User[]>(
            'SELECT * FROM users WHERE email = ?',
            [credentials.email]
          );

          if (users.length === 0) {
            return null;
          }

          const user = users[0];
          const isValid = await bcrypt.compare(credentials.password, user.senha || '');

          if (!isValid) {
            return null;
          }

          // Busca permissões
          const permissions = await query<Permission[]>(
            'SELECT * FROM permissions WHERE user_id = ?',
            [user.id]
          );

          // Busca módulos do usuário
          const moduleAccess = await query<(ModuleAccess & Module)[]>(
            `SELECT m.* FROM modules m 
             INNER JOIN module_access ma ON m.id = ma.module_id 
             WHERE ma.user_id = ?`,
            [user.id]
          );

          return {
            id: String(user.id),
            name: user.nome,
            email: user.email,
            grupo: user.grupo,
            permissions: permissions[0] || { cadastrar: false, batepapo: false },
            modules: moduleAccess,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.grupo = (user as any).grupo;
        token.permissions = (user as any).permissions;
        token.modules = (user as any).modules;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).grupo = token.grupo;
        (session.user as any).permissions = token.permissions;
        (session.user as any).modules = token.modules;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
