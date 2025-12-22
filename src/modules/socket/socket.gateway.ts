import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  emitSensor(room: string, data: any) {
    this.server.emit(`sensor:${room}`, data);
  }

  emitDevices(data: any) {
    this.server.emit(`devices`, data);
  }

  emitDevice(room: string, data: any) {
    this.server.emit(`device:${room}`, data);
  }
}