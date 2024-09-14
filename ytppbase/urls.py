from django.contrib import admin
from django.urls import path
from ytppmain import views  # Import views from your app

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),  # Home page
    path('playlist/<str:playlist_id>/', views.playlist, name='playlist'),  # Update this line
    path('audio/<str:video_id>/', views.audio, name='audio'),  # Audio extraction view
]
