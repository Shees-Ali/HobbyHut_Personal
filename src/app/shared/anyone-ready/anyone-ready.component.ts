import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CoreFacade } from 'src/app/core/core.facade';
import { isProfileComplete } from 'src/app/core/profile';
import { CalculateAgePipe } from '../calculate-age/calculate-age.pipe';
import { Browser } from '@capacitor/browser';

interface OnlineUser {
  uid: string;
  displayName: string;
  profilePicture: string;
  hobbyName: string;
  skillLevel: string;
  meta: any;
  isActive: boolean;
  photos: string[];
}

@Component({
  selector: 'app-anyone-ready',
  templateUrl: './anyone-ready.component.html',
  styleUrls: ['./anyone-ready.component.scss'],
})
export class AnyoneReadyComponent implements OnInit, OnDestroy, AfterViewInit {
  onlineUsers: OnlineUser[] = [];
  isLoading = true;
  ads: any[] = [];
  private loadingTimeout: any;
  private agePipe = new CalculateAgePipe();
  private filters: { ageRange: any; gender: any; radius: any } = {
    ageRange: null,
    gender: null,
    radius: null,
  };

  constructor(
    private modalCtrl: ModalController,
    private coreFacade: CoreFacade,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadFilters();
    this.loadOnlineFriends();
  }

  ngAfterViewInit() {
    this.loadAdvertisements();
  }

  private async loadAdvertisements() {
    if (!this.ads.length) {
      this.ads = await this.coreFacade.getAllAds();
    }
  }

  getAdForIndex(index: number): any {
    if (!this.ads.length) return null;
    return this.ads[index % this.ads.length];
  }

  async openAd(ad: any) {
    if (ad?.link) {
      await Browser.open({ url: ad.link });
    }
  }

  ngOnDestroy() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  private loadFilters() {
    const storedFiltersStr = localStorage.getItem('filters');
    if (storedFiltersStr !== null) {
      const storedFilters = JSON.parse(storedFiltersStr);
      this.filters.ageRange = storedFilters.ageRange;
      this.filters.gender = storedFilters.gender;
    }
    const storedRadiusStr = localStorage.getItem('filters-radius');
    if (storedRadiusStr !== null) {
      this.filters.radius = JSON.parse(storedRadiusStr);
    }
    if (!this.filters.gender) {
      this.filters.gender = 'both';
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private passesFilters(profile: any): boolean {
    const genderFilter = this.filters.gender && this.filters.gender !== 'both';
    const ageFilter = !!this.filters.ageRange?.value;
    const radiusFilter = !!this.filters.radius?.value;

    if (genderFilter) {
      const userGender = profile?.gender?.toLowerCase();
      if (userGender !== this.filters.gender?.toLowerCase() && userGender !== 'non-binary') {
        return false;
      }
    }

    if (ageFilter) {
      const memberAge = this.agePipe.transform(profile?.dob);
      if (
        memberAge < this.filters.ageRange.value.lower ||
        memberAge > this.filters.ageRange.value.upper
      ) {
        return false;
      }
    }

    if (radiusFilter) {
      const currentUser = this.coreFacade.user as any;
      const currentCoords = currentUser?.coordinates;
      const otherCoords = profile?.coordinates;
      if (currentCoords && otherCoords) {
        const distance = this.calculateDistance(
          currentCoords.latitude,
          currentCoords.longitude,
          otherCoords.latitude,
          otherCoords.longitude,
        );
        const radiusKm = this.filters.radius.value * 1.609;
        if (distance > radiusKm) {
          return false;
        }
      }
    }

    return true;
  }

  private async loadOnlineFriends() {
    this.loadingTimeout = setTimeout(() => {
      this.isLoading = false;
    }, 10000);

    try {
      const activeUsers = (await combineLatest([this.coreFacade.fetchActiveUsers()])
        .pipe(take(1))
        .toPromise()) as any[];

      const userArray = activeUsers[0] as any[];

      if (userArray.length === 0) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
        this.isLoading = false;
        return;
      }

      const profilePromises = userArray.map((member: any) =>
        this.coreFacade.getUserObj(member.uid),
      );
      const profiles = await Promise.all(profilePromises);

      console.log('Fetched profiles for online users:', profiles);

      const hasActiveFilters =
        this.filters.ageRange?.value ||
        (this.filters.gender && this.filters.gender !== 'both') ||
        this.filters.radius?.value;

      console.log('Applying filters:', this.filters);

      this.onlineUsers = userArray
        .map((member: any, index: number) => {
          const profile = profiles[index] as any;
          const hobbyName = member?.hobby?.length > 0 ? member.hobby[0].name : '';
          const photos = profile?.photos || [];
          const userHobby = profile?.hobbies?.find((h: any) => h.name === hobbyName);
          return {
            uid: member.uid,
            displayName: profile?.displayName || 'Unknown',
            profilePicture:
              photos.length > 0 ? photos[photos.length - 1] : './../../assets/images/palm-tree.png',
            hobbyName,
            skillLevel: userHobby?.skillLevel || 'Beginner',
            meta: userHobby?.meta || {},
            isActive: true,
            photos: photos,
            profile,
          };
        })
        // Users who have not completed their profile are never listed.
        .filter((user: any) => isProfileComplete(user.profile))
        .filter((user: any) => !hasActiveFilters || this.passesFilters(user.profile))
        .map(({ profile, ...user }) => user);

      console.log('Loaded online users:', this.onlineUsers);

      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
      this.isLoading = false;
    } catch (e) {
      console.error('Error loading online users:', e);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  openProfile(uid: string) {
    this.modalCtrl.dismiss().then(() => {
      this.router.navigate(['/tabs/profile/user', uid]);
    });
  }
}
