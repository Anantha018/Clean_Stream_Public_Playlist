# ytppmain/views.py
from django.shortcuts import render
from django.http import JsonResponse
import requests
import re
import json
from bs4 import BeautifulSoup
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from yt_dlp import YoutubeDL
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache

# To update "pip install --user -U yt-dlp" in the terminal

DEVELOPER_KEY = 'AIzaSyD7KgygEbYsJgDiPKLca2TmFffoJuqdScY'
YOUTUBE_API_SERVICE_NAME = 'youtube'
YOUTUBE_API_VERSION = 'v3'


def home(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        if username:
            try:
                playlist_data = get_playlist_info(username)
                return render(request, 'home.html', {'username': username, 'playlists': playlist_data, 'error': None})
            except ValueError as ve:
                return render(request, 'home.html', {'username': username, 'playlists': None, 'error': str(ve)})
        else:
            return render(request, 'home.html', {'username': None, 'playlists': None, 'error': "Username not provided."})
    else:
        return render(request, 'home.html', {'username': None, 'playlists': None, 'error': None})


def playlist(request, playlist_id):  # Accept playlist_id as a parameter
    if not playlist_id:
        return render(request, 'home.html', {'error': 'Playlist ID is required.'})
    try:
        videos = fetch_youtube_playlist_items(playlist_id)
        playlist_title = fetch_playlist_title(playlist_id)

        # Preprocess titles to escape single quotes
        for video in videos:
            video['title'] = video['title'].replace("'", "\\'")  # Escape single quotes

        return render(request, 'playlist.html', {'videos': videos, 'playlist_title': playlist_title})
    except HttpError as e:
        return render(request, 'home.html', {'error': f"An error occurred: {e}"})


CLOUDFLARE_WORKER_URL = "https://ytproxyaudio.sridharindie.workers.dev/?video_id="

def fetch_audio_url(video_id):
    """Fetches the audio URL from YouTube using yt-dlp."""
    
    if cache.get(video_id):  # Check if URL is already cached
        return cache.get(video_id)

    # 🔹 Step 1: Fetch Video Details from Cloudflare Worker
    try:
        response = requests.get(CLOUDFLARE_WORKER_URL + video_id)
        if response.status_code != 200:
            return None
        
        video_info = response.json()
        if "video_info" not in video_info:
            return None
    except Exception as e:
        return None  # Return None if Cloudflare request fails

    # 🔹 Step 2: Extract Audio URL Using yt-dlp
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio',
        'quiet': True,
        'noplaylist': True,
        'retries': 2,
        'skip_download': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            audio_url = info.get('url')
            if audio_url:
                cache.set(video_id, audio_url, timeout=600)  # Cache for 10 minutes
                return audio_url
    except Exception:
        return None  # Return None if yt-dlp fails

    return None

def get_audio_url(request):
    """Django view that retrieves the audio URL for a given YouTube video ID."""
    
    video_id = request.GET.get('video_id', '').strip()  # Extract video ID from query params

    if not video_id:
        return JsonResponse({'error': 'Video ID parameter is missing'}, status=400)

    # Fetch audio URL
    audio_url = fetch_audio_url(video_id)

    if audio_url:
        return JsonResponse({'audio_url': audio_url})

    return JsonResponse({'error': 'Could not fetch audio URL'}, status=500)


def get_playlist_info(channel_name):
    base_url = f'https://www.youtube.com/@{channel_name}/playlists'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(base_url, headers=headers)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        scripts = soup.find_all('script')
        playlists_info = []
        seen_ids = set()
        for script in scripts:
            if 'playlistId' in script.text:
                playlist_data = re.findall(r'"playlistId":"([A-Za-z0-9_-]+)"', script.text)
                if playlist_data:
                    for playlist_id in playlist_data:
                        if playlist_id not in seen_ids:
                            playlist_title = get_playlist_title(playlist_id)
                            if playlist_title:
                                playlists_info.append({'id': playlist_id, 'title': playlist_title})
                                seen_ids.add(playlist_id)
        return playlists_info
    else:
        raise ValueError("Failed to retrieve playlists.")
    

def get_playlist_title(playlist_id):
    base_url = f'https://www.youtube.com/playlist?list={playlist_id}'
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"}
    response = requests.get(base_url, headers=headers)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        scripts = soup.find_all('script')
        for script in scripts:
            if 'ytInitialData' in script.text:
                json_text_match = re.search(r'var ytInitialData = ({.*?});', script.text, re.DOTALL)
                if json_text_match:
                    json_text = json_text_match.group(1)
                    try:
                        initial_data = json.loads(json_text)
                        return initial_data['metadata']['playlistMetadataRenderer']['title']
                    except (KeyError, json.JSONDecodeError):
                        return None
    return None

def fetch_youtube_playlist_items(playlist_id):
    youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=DEVELOPER_KEY)
    playlist_items = []
    next_page_token = None
    while True:
        request = youtube.playlistItems().list(part='snippet', playlistId=playlist_id, maxResults=50, pageToken=next_page_token)
        response = request.execute()
        playlist_items.extend(response['items'])
        next_page_token = response.get('nextPageToken')
        if not next_page_token:
            break

    videos = []
    for item in playlist_items:
        video_id = item['snippet']['resourceId']['videoId']
        title = item['snippet']['title']
        thumbnails = item['snippet']['thumbnails']
        thumbnail_url = thumbnails.get('high', {}).get('url', 'https://via.placeholder.com/480x360?text=No+Thumbnail')
        videos.append({'title': title, 'audio_url': f"/audio/{video_id}", 'thumbnail_url': thumbnail_url})

    return videos


def fetch_playlist_title(playlist_id):
    youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=DEVELOPER_KEY)
    request = youtube.playlists().list(part='snippet', id=playlist_id)
    response = request.execute()
    return response['items'][0]['snippet']['title']


def csrf_failure(request, reason=""):
    return render(request, 'csrf_error.html')