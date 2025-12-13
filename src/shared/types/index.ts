import { Request } from 'express';

export interface IRequest extends Request {
  user: {
    id: string,
    username: string,
    fullName: string,
    roles: {
      id: string,
      name: string,
      isActive: boolean,
      isSystemRole: boolean,
      description: string,
      permissions: {
        id: string,
        name: string,
        description: string,
        path: string,
        method: string,
        module: string
      }[]
    }[]
  }
}

export interface IRouteInfo {
  module: string;
  controller: string;
  method: string;
  path: string;
  handler: string;
}
