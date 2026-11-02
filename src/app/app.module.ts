import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireAuthGuard } from '@angular/fire/compat/auth-guard';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { environment } from './../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
// import { Facebook } from "@ionic-native/facebook/ngx";
import { HTTP } from "@ionic-native/http/ngx";
import { EmailComposer } from '@ionic-native/email-composer/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
// import { Diagnostic } from '@ionic-native/diagnostic/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
// import { LocationAccuracy } from '@ionic-native/location-accuracy/ngx';
// import { LinkedIn } from '@ionic-native/linkedin';
import { HttpClientModule } from '@angular/common/http';
import { Player2GameComponent } from './shared/player2-game/player2-game.component';
import { MessageService } from './message.service';
// import { SignInWithApple } from '@awesome-cordova-plugins/sign-in-with-apple/ngx';
import { Badge } from '@awesome-cordova-plugins/badge/ngx';

@NgModule({
  declarations: [AppComponent,Player2GameComponent],
  entryComponents: [Player2GameComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase.config),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    HttpClientModule
  ],
  providers: [
    // SignInWithApple,
    AngularFireAuthGuard,
    StatusBar,
    SplashScreen,
    // Facebook,
    EmailComposer,
    SocialSharing,
    Geolocation,
    // Diagnostic,
    AndroidPermissions,
    // LocationAccuracy,
    // LinkedIn,
    MessageService,
    HTTP,
    Badge,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
