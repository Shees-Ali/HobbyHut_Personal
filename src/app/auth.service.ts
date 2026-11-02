import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private httpClient: HttpClient) { }
  sendPostRequest(data: any): Observable<any> {
    let options = new HttpHeaders().set('Content-Type', 'application/json');
    const url = "https://fcm.googleapis.com/fcm/send";
    return this.httpClient.post<any>(url, data, {
      headers: options.append('Authorization', 'key=AAAAPKcNGus:APA91bF-FVvFuGlYweyFzYtbqxK_23DI33mVSbF6Wakb9OAqVcSiU8qRYZIUCOC4UE8i48YPcvPhTZeUjSvE9_6mVuz5nolc-c_nt2QqL6zWettaHpan6RVDflrGQ-KySgo0YyMcKpTs'),
    });
  }
}
