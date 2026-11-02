import { Pipe, PipeTransform } from '@angular/core';
import { CalculateAgePipe } from '../calculate-age/calculate-age.pipe';
import { User } from './../../core/core.model';

@Pipe({
  name: 'filterMembers',
})
export class FilterMembersPipe implements PipeTransform {
  agePipe = new CalculateAgePipe();

  transform(
    members: any[],
    { ageRange = { value: undefined }, gender = undefined, username = '' }
  ): any {
    const ageFilter = !!ageRange?.value;
    const genderFilter = !!gender;
    const searchFilter = username && username.trim() !== '';

    if (ageFilter === false && genderFilter === false && searchFilter === false) {
      return members;
    }

    if (members) {
      return members.filter((member: User) => {
        let passStatus = true;

        if (ageFilter) {
          const memberAge = this.agePipe.transform(member.dob);
          passStatus = memberAge >= ageRange.value.lower && memberAge <= ageRange.value.upper;
        }

        if (genderFilter && gender !== 'both') {
          passStatus = member.gender === gender || member.gender === 'non-binary';
        }

        if (searchFilter) {
          const searchTerm = username.toLowerCase();
          passStatus = member.username ? member.username.toLowerCase().includes(searchTerm) : false;
        }

        return passStatus;
      });
    }
  }
}
