import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import {
  AngularFireAuthGuard,
  redirectLoggedInTo,
  redirectUnauthorizedTo
} from '@angular/fire/compat/auth-guard';
import { ProfileCompleteGuard } from './core/profile-complete.guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['sign-in']);
const redirectLoggedInToHome = () => redirectLoggedInTo(['']);

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AngularFireAuthGuard, ProfileCompleteGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin }
  },
  {
    path: 'messages/:chatID/chat',
    loadChildren: () => import('./chat/chat.module').then(m => m.ChatPageModule),
    canActivate: [AngularFireAuthGuard, ProfileCompleteGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin }
  },
  {
    path: 'complete-profile',
    loadChildren: () =>
      import('./complete-profile/complete-profile.module').then(m => m.CompleteProfilePageModule),
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin }
  },
  {
    path: 'sign-in',
    loadChildren: () => import('./sign-in/sign-in.module').then(m => m.SignInPageModule),
    canActivate: [AngularFireAuthGuard],
    data: { authGuardPipe: redirectLoggedInToHome }
  },
  {
    path: 'post-chat/:postID',
    loadChildren: () => import('./post-chat/post-chat.module').then( m => m.PostChatPageModule),
    canActivate: [AngularFireAuthGuard, ProfileCompleteGuard],
    data: { authGuardPipe: redirectUnauthorizedToLogin }
  },

 
];
@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
