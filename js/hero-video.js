document.addEventListener('DOMContentLoaded', function () {
  var hero = document.querySelector('.hero');
  if (!hero || hero.querySelector('.hero-video')) return;
  var video = document.createElement('video');
  video.className = 'hero-video';
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = 'assets/generated/dronehub-hero-v2.png';
  video.setAttribute('aria-hidden', 'true');
  video.innerHTML = '<source src="video%202.mp4" type="video/mp4">';
  hero.insertBefore(video, hero.firstChild);
  video.play().catch(function () {});
});
