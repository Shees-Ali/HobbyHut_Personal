import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'messagesFilter',
})
export class MessagesFilterPipe implements PipeTransform {
  transform(value: any[], messageType: string): any {
    if (!value) {
      return;
    }

    return value.filter((msg) => {
      if (messageType === 'requests') {
        return msg.meta?.isMessageRequest;
      }

      return !!!msg.meta?.isMessageRequest;
    });
  }
}
