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

DEVELOPER_KEY = 'AIzaSyD7KgygEbYsJgDiPKLca2TmFffoJuqdScY'
YOUTUBE_API_SERVICE_NAME = 'youtube'
YOUTUBE_API_VERSION = 'v3'

# Home View
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

# Playlist View
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

# Audio extraction View
def audio(request, video_id):
    try:
        yt_url = f'https://www.youtube.com/watch?v={video_id}'
        ydl_opts = {'format': 'bestaudio[ext=m4a]/best', 'quiet': True, 'noplaylist': True}
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(yt_url, download=False)
            audio_url = info['url']
            return JsonResponse({'audio_url': audio_url})
    except Exception as e:
        return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)

# Helper functions (same as Flask)
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
    headers = {'User-Agent': 'Mozilla/5.0'}
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
