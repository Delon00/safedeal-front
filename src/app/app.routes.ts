import { Routes } from '@angular/router';
import { Home } from './presentation/home/home';
import { UserProfile } from './presentation/user-profile/user-profile';


export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: Home },
    { path: 'profile', component: UserProfile }
];