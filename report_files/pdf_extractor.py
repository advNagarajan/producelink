import sys
import subprocess

try:
    import PyPDF2
except ImportError:
    print("Installing PyPDF2...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2", "--quiet"])
    import PyPDF2

pdf_path = r"C:\Users\Aadhav Nagarajan\Downloads\aicte 5th sem report.pdf"
output_path = r"c:\Users\Aadhav Nagarajan\OneDrive\Desktop\College Stuff\producelink\producelink\pdf_content.txt"

text = ""
try:
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
            
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("SUCCESS: PDF text extracted successfully.")
except Exception as e:
    print(f"ERROR: {e}")
