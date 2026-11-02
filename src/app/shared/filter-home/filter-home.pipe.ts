import { Pipe, PipeTransform } from '@angular/core';
import { CalculateAgePipe } from '../calculate-age/calculate-age.pipe';
@Pipe({
  name: 'filterHome',
})
export class FilterHomePipe implements PipeTransform {
  agePipe = new CalculateAgePipe();
  transform(hobbies: any[], { ageRange = { value: undefined }, gender = undefined }) {
    const ageFilter = !!ageRange?.value;
    const genderFilter = !!gender;

    //default data
    if (ageFilter === false && genderFilter === false) {
      if (hobbies) {
        for (let i = 0; i < hobbies.length; i++) {
          hobbies[i].showGame = true;
          hobbies[i].filtermemberInfo = hobbies[i].memberInfo;
          hobbies[i].isAvailable = true; // Add flag for available hobbies
        }
        return hobbies;
      }
    }

    if (hobbies) {
      for (let i = 0; i < hobbies.length; i++) {
        hobbies[i].filtermemberInfo = hobbies[i].memberInfo;
        if (ageFilter) {
          hobbies[i].filtermemberInfo = hobbies[i].filtermemberInfo.filter((memberInfo) => {
            const memberAge = this.agePipe.transform(memberInfo.dob);
            return memberAge >= ageRange.value.lower && memberAge <= ageRange.value.upper;
          });
        }
        if (genderFilter && gender !== 'both') {
          hobbies[i].filtermemberInfo = hobbies[i].filtermemberInfo.filter((memberInfo) => {
            return memberInfo.gender == gender || memberInfo.gender == 'non-binary';
          });
        }
        if (hobbies[i].filtermemberInfo?.length == 0 && hobbies[i].memberInfo?.length > 0) {
          hobbies[i].showGame = true;
          hobbies[i].isAvailable = false; // Add flag for unavailable hobbies
        } else {
          hobbies[i].showGame = true;
          hobbies[i].isAvailable = true; // Add flag for available hobbies
        }
      }
      return hobbies;
    }
  }
}
