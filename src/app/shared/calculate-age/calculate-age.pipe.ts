import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'calculateAge'
})
export class CalculateAgePipe implements PipeTransform {

  transform(value: any, ...args: any[]): any {
      if (!value) { return; }

      const timeDiff = Math.abs(Date.now() - new Date(value).getTime());
      return Math.floor(timeDiff / (1000 * 3600 * 24) / 365.25);

  }

}
