from django.contrib import admin
from django.urls import path
from ytppmain import views  # Import views from your app

urlpatterns = [
    path('adminsitekavalientra/', admin.site.urls),
    path('', views.home, name='home'),  # Home page
    path('playlist/<str:playlist_id>/', views.playlist, name='playlist'),  
    path('audio/', views.get_audio_url, name='audio'),
]
