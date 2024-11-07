let currentIndex = 0;
const banners = document.querySelectorAll('.banner-image');
const rotationInterval = 3000; // Rotate every 3 seconds

function rotateBanner() {
  // Hide all banners initially
  banners.forEach((banner, index) => {
    banner.style.opacity = index === currentIndex ? '1' : '0';
  });

  // Move to the next image
  currentIndex = (currentIndex + 1) % banners.length;
}

// Initial rotation and interval setting
rotateBanner();
setInterval(rotateBanner, rotationInterval);
