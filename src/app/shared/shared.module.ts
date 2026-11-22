import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AddHobbyComponent } from './add-hobby/add-hobby.component';
import { CalculateAgePipe } from './calculate-age/calculate-age.pipe';
import { EditHobbiesComponent } from './edit-hobbies/edit-hobbies.component';
import { EquipmentListComponent } from './equipment-list/equipment-list.component';
import { FiltersComponent } from './filters/filters.component';
import { SkillLevelComponent } from './skill-level/skill-level.component';
import { UpdateProfileComponent } from './update-profile/update-profile.component';
import { VerifyAccountComponent } from './verify-account/verify-account.component';
import { FilterMembersPipe } from './filter-members/filter-members.pipe';
import { MessagesFilterPipe } from './messages-filter/messages-filter.pipe';
import { Player1GameComponent } from './player1-game/player1-game.component';
import { FiltersHomeComponent } from './filters-home/filters-home.component';
import { FilterHomePipe } from './filter-home/filter-home.pipe';
import { CreatePostComponent } from './create-post/create-post.component';
import { RequestsComponent } from './requests/requests.component';
import { CapitalizeFirstModule } from '../directives/capitalize-first/capitalize-first.module';
import { TitleCaseWordsPipe } from '../directives/capitalize-first/title-case.pipe';
import { FromContactsComponent } from './from-contacts/from-contacts.component';
import { SearchFriendsComponent } from './search-friends/search-friends.component';
import { AnyoneReadyComponent } from './anyone-ready/anyone-ready.component';
import { PhotoCropperComponent } from './photo-cropper/photo-cropper.component';

@NgModule({
  entryComponents: [
    AddHobbyComponent,
    EditHobbiesComponent,
    FiltersComponent,
    FiltersHomeComponent,
    VerifyAccountComponent,
    UpdateProfileComponent,
    Player1GameComponent,
    SkillLevelComponent,
    CreatePostComponent,
    RequestsComponent,
    SearchFriendsComponent,
    AnyoneReadyComponent,
    PhotoCropperComponent,
  ],
  declarations: [
    AddHobbyComponent,
    SkillLevelComponent,
    EditHobbiesComponent,
    FiltersComponent,
    FiltersHomeComponent,
    EquipmentListComponent,
    VerifyAccountComponent,
    UpdateProfileComponent,
    CalculateAgePipe,
    FilterMembersPipe,
    FilterHomePipe,
    MessagesFilterPipe,
    Player1GameComponent,
    CreatePostComponent,
    RequestsComponent,
    FromContactsComponent,
    SearchFriendsComponent,
    AnyoneReadyComponent,
    PhotoCropperComponent,
    TitleCaseWordsPipe,
  ],
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, CapitalizeFirstModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [
    SkillLevelComponent,
    UpdateProfileComponent,
    EquipmentListComponent,
    CalculateAgePipe,
    FilterMembersPipe,
    FilterHomePipe,
    MessagesFilterPipe,
    CreatePostComponent,
    TitleCaseWordsPipe,
  ],
})
export class SharedModule {}
