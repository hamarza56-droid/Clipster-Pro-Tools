import os
import subprocess

FFMPEG_BIN = "ffmpeg"


def process_reel(input_video, background_img, output_path):
    """
    9:16 Reel background changer engine
    """

    cmd = [
        FFMPEG_BIN,

        "-i", input_video,
        "-i", background_img,

        "-filter_complex",
        """
        [0:v]scale=720:-1,setsar=1,format=rgba[reel];
        [1:v]scale=1080:1920,blur=20[bg];

        [bg][reel]overlay=(W-w)/2:(H-h)/2
        """,

        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-y",
        output_path
    ]

    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
