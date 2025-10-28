import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Posts } from '../shared/model';

@Injectable({
  providedIn: 'root'
})
export class Post {

  constructor(private http: HttpClient) { }

  private readonly baseUrl = 'https://jsonplaceholder.typicode.com/posts';

  fetchPost(currentPage: number, limit: number) {

    const url = `${this.baseUrl}?_page=${currentPage}&_limit=${limit}`;

    return this.http.get<Posts[]>(url);

  }

}
