// overview.controller.ts
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { OverviewResponseDto, OverviewStateDto } from './overview.dto';

@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  async getOverview() {
    return this.overviewService.getOverview();
  }

  // API bật/tắt tất cả đèn
  @Patch('lights')
  async controlAllLights(@Body() body: OverviewStateDto) {
    await this.overviewService.controlAllLights(body.state);
    return { message: `All lights turned ${body.state}` };
  }

  // API khóa/mở tất cả cửa
  @Patch('doors')
  async controlAllDoors(@Body() body: OverviewStateDto) {
    await this.overviewService.controlAllDoors(body.state);
    return { message: `All doors ${body.state}ed` };
  }

  // API đóng/mở tất cả cửa sổ
  @Patch('windows')
  async controlAllWindows(@Body() body: OverviewStateDto) {
    await this.overviewService.controlAllWindows(body.state);
    return { message: `All windows ${body.state ? 'opened' : 'closed'}` };
  }
}
