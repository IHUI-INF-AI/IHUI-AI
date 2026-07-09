export interface User {
  id: string;
  phone: string;
  email: string;
  nickname: string;
  avatar: string;
  familyId: string;
  roleId: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  bio: string;
  gender: number;
  birthday: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
