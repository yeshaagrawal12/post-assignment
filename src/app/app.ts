import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Post } from '../service/post';
import { Posts } from '../shared/model';
import { debounceTime, distinctUntilChanged, Subject, Subscription, throttleTime } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule, ScrollingModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {

  @ViewChild('viewport') viewport!: CdkVirtualScrollViewport;
  currentPage = 1;
  private readonly pageSize = 25;

  posts = signal<Posts[]>([]);
  filteredPosts = signal<Posts[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  hasReachedEnd = signal<boolean>(false);
  error = signal<string | null>(null);
  searchQuery: string = '';

  subscription: Subscription = new Subscription();
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private scrollSub?: Subscription;
  constructor(private postsService: Post,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.updateUrlParam(query);
      this.filterPosts();
    });

    // Get search query from URL
    this.route.queryParams.subscribe(params => {
      const urlSearch = params['search'] || '';
      if (urlSearch !== this.searchQuery) {
        this.searchQuery = urlSearch;
        this.filterPosts();
      }
    });
    this.loadPosts();
  }

  ngAfterViewChecked() {
    // Wait until viewport is rendered and subscription isn't set yet
    if (this.viewport && !this.scrollSub) {
      this.attachScrollListener();
    }
  }

  private attachScrollListener() {
    this.scrollSub = this.viewport!.elementScrolled()
      .pipe(throttleTime(100))
      .subscribe(() => this.checkIfNearBottom());
  }

  updateUrlParam(search: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: search || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  loadPosts(): void {
    if (this.isLoading() || this.isLoadingMore() || this.hasReachedEnd()) {
      return;
    }

    if (this.currentPage === 1) {
      this.isLoading.set(true);
    } else {
      this.isLoadingMore.set(true);
    }

    this.error.set(null);

    this.subscription = this.postsService.fetchPost(this.currentPage, this.pageSize).subscribe({
      next: (newPosts) => {
        if (newPosts.length === 0) {
          this.hasReachedEnd.set(true);
        } else {
          this.posts.set([...this.posts(), ...newPosts]);
          this.filterPosts();
          this.currentPage++;
        }
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load posts. Please check your connection and try again.');
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
        console.error('Error loading posts:', err);
      }
    });
  }

  filterPosts(): void {
    let filtered = [...this.posts()];
    const searchTerm = this.searchQuery;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(term) ||
        post.body.toLowerCase().includes(term)
      );
    }

    this.filteredPosts.set(filtered);
  }

  private checkIfNearBottom() {
    if (!this.viewport) return;

    const scrollOffset = this.viewport.measureScrollOffset('bottom');

    // If less than 300px from the bottom, trigger load
    const nearBottomThreshold = 300;

    if (
      scrollOffset < nearBottomThreshold &&
      !this.isLoadingMore() &&
      !this.hasReachedEnd()
    ) {
      this.loadPosts();
    }
  }

  retryLoad() {
    this.error.set('');
    this.loadPosts();
  }

  onSearchChange(event: string) {
    this.searchSubject.next(this.searchQuery);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchSubject.next('');
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.scrollSub?.unsubscribe();
  }
}
